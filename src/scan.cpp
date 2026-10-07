// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "internal.hpp"
#include <algorithm>
#include <unordered_set>

namespace synomizer {
namespace {
bool space(unsigned char c) { return c == ' ' || c == '\t' || c == '\n'; }
bool digit(unsigned char c) { return c >= '0' && c <= '9'; }
bool abbrev(std::string_view w) {
  static const std::unordered_set<std::string_view> words = {
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "eg", "ie", "am", "pm",
    "fig", "vol", "gen", "col", "capt", "rev", "hon", "dept", "approx"};
  return words.contains(w);
}
std::size_t unicode_punct(std::string_view t, std::size_t i) {
  for (std::string_view v : {"\xE2\x80\x98", "\xE2\x80\x99", "\xE2\x80\x9C", "\xE2\x80\x9D",
       "\xE2\x80\x93", "\xE2\x80\x94", "\xE2\x80\xA6", "\xC2\xA0", "\xEF\xBB\xBF"}) {
    if (t.substr(i).starts_with(v)) return v.size();
  }
  return 0;
}
bool quote(std::string_view v) {
  return v == "\"" || v == "'" || v == "\xE2\x80\x98" || v == "\xE2\x80\x99" ||
    v == "\xE2\x80\x9C" || v == "\xE2\x80\x9D";
}
bool terminal(std::string_view v) {
  return !v.empty() && v.find_first_not_of(".!?") == std::string_view::npos;
}
// Identify opaque spans before sentence splitting. Their contents never enter the lexicon.
std::size_t opaque_end(std::string_view t, std::size_t i) {
  if (t[i] == '`' || t.substr(i).starts_with("~~~")) {
    const char marker = t[i];
    std::size_t n = 1;
    while (i + n < t.size() && t[i+n] == marker) ++n;
    const std::string delimiter(n, marker);
    const auto end = t.find(delimiter, i+n);
    return end == std::string_view::npos ? t.size() : end+n;
  }
  if (t[i] == '<') {
    const auto end = t.find('>', i+1);
    if (end != std::string_view::npos) return end+1;
  }
  if (t[i] == '[' || (t[i] == '!' && i+1 < t.size() && t[i+1] == '[')) {
    const auto mid = t.find("](", i+1);
    const auto newline = t.find('\n', i+1);
    if (mid != std::string_view::npos && (newline == std::string_view::npos || mid < newline)) {
      int depth = 1;
      for (std::size_t k = mid+2; k < t.size() && t[k] != '\n'; ++k) {
        if (t[k] == '(') ++depth;
        if (t[k] == ')' && --depth == 0) return k+1;
      }
    }
  }
  if (!is_letter(static_cast<unsigned char>(t[i])) && !digit(static_cast<unsigned char>(t[i]))) return i;
  std::size_t end = i;
  while (end < t.size() && !space(static_cast<unsigned char>(t[end])) &&
      std::string_view("<>\"'`()[]{}").find(t[end]) == std::string_view::npos && !unicode_punct(t,end)) ++end;
  const auto part = t.substr(i,end-i);
  bool opaque = part.find('@') != std::string_view::npos || part.find('/') != std::string_view::npos ||
    part.find('\\') != std::string_view::npos || part.find('_') != std::string_view::npos;
  for (std::size_t k=0; k+1<part.size(); ++k) {
    if (part[k] == '.' && (is_letter(static_cast<unsigned char>(part[k+1])) || digit(static_cast<unsigned char>(part[k+1])))) opaque = true;
  }
  if (!opaque) return i;
  while (end > i && std::string_view(".,!?;:").find(t[end-1]) != std::string_view::npos) --end;
  return end;
}
std::vector<Token> tokenize(std::string_view text) {
  std::vector<Token> tokens;
  for (std::size_t i=0; i<text.size();) {
    std::size_t j=i+1;
    bool word=false, frozen=false;
    const auto c=static_cast<unsigned char>(text[i]);
    if (space(c)) {
      while (j<text.size() && space(static_cast<unsigned char>(text[j]))) ++j;
    } else if (const auto opaque=opaque_end(text,i); opaque>i) {
      j=opaque; frozen=true;
    } else if (const auto width=unicode_punct(text,i)) {
      j=i+width;
    } else if (is_letter(c) || digit(c) || c>=128) {
      word=true; frozen=digit(c) || c>=128;
      while (j<text.size()) {
        const auto d=static_cast<unsigned char>(text[j]);
        if ((is_letter(d) || digit(d) || d>=128) && !unicode_punct(text,j)) {
          frozen = frozen || digit(d) || d>=128; ++j; continue;
        }
        if ((d=='\'' || d=='-') && j+1<text.size() && is_letter(static_cast<unsigned char>(text[j+1]))) {
          frozen = true; ++j; continue;
        }
        if (text.substr(j).starts_with("\xE2\x80\x99") && j+3<text.size() && is_letter(static_cast<unsigned char>(text[j+3]))) {
          frozen=true; j+=3; continue;
        }
        break;
      }
      // Freeze a plural possessive without mistaking its apostrophe for an opening quote.
      if (j<text.size() && text[j]=='\'' && j>i && text[j-1]=='s') { ++j; frozen=true; }
    } else if (terminal(text.substr(i,1))) {
      while (j<text.size() && terminal(text.substr(j,1))) ++j;
    }
    tokens.push_back(Token{std::string(text.substr(i,j-i)),word,frozen,false});
    i=j;
  }
  return tokens;
}
} // namespace

std::string concat_tokens(const std::vector<Token>& tokens) {
  std::string out;
  for (const auto& t:tokens) out+=t.text;
  return out;
}

std::vector<Piece> split_pieces(std::string_view input) {
  const auto tokens=tokenize(input);
  std::vector<Piece> pieces;
  std::vector<Token> current;
  std::vector<std::string> quotes;
  auto flush=[&] {
    if (current.empty()) return;
    pieces.push_back(Piece{true,concat_tokens(current),std::move(current)});
    current.clear();
  };
  for (std::size_t i=0; i<tokens.size(); ++i) {
    const auto& token=tokens[i];
    const bool whitespace=!token.word && !token.frozen && token.text.find_first_not_of(" \t\n")==std::string::npos;
    if (whitespace && quotes.empty() && (current.empty() || token.text.find('\n')!=std::string::npos)) {
      flush(); pieces.push_back(Piece{false,token.text,{}}); continue;
    }
    current.push_back(token);
    bool closed=false;
    if (quote(token.text)) {
      std::string closing=token.text;
      if (token.text=="\xE2\x80\x9C") closing="\xE2\x80\x9D";
      if (token.text=="\xE2\x80\x98") closing="\xE2\x80\x99";
      if (!quotes.empty() && quotes.back()==token.text) { quotes.pop_back(); closed=true; }
      else if (token.text!="\xE2\x80\x9D" && token.text!="\xE2\x80\x99") quotes.push_back(closing);
    }
    bool boundary=quotes.empty() && (terminal(token.text) || (closed && i>0 && terminal(tokens[i-1].text)));
    if (boundary && token.text=="." && i>0 && tokens[i-1].word) {
      const auto w=lower_copy(tokens[i-1].text);
      if (w.size()==1 || abbrev(w)) boundary=false;
    }
    if (boundary && i+1<tokens.size()) {
      const auto& next=tokens[i+1];
      boundary=!next.word && !next.text.empty() && space(static_cast<unsigned char>(next.text.front()));
    }
    if (boundary) flush();
  }
  // Preserve trailing whitespace even when an unterminated sentence has no full stop.
  std::string suffix;
  if (!current.empty() && !current.back().word && !current.back().frozen &&
      current.back().text.find_first_not_of(" \t\n")==std::string::npos) {
    suffix=current.back().text; current.pop_back();
  }
  flush();
  if (!suffix.empty()) pieces.push_back(Piece{false,std::move(suffix),{}});
  return pieces;
}
} // namespace synomizer
