// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "internal.hpp"
#include <unordered_set>

namespace synomizer {
namespace {
bool space(unsigned char c) { return c == ' ' || c == '\t' || c == '\r' || c == '\n'; }
bool digit(unsigned char c) { return c >= '0' && c <= '9'; }
std::size_t special(std::string_view t, std::size_t i) {
  for (std::string_view s : {"\xE2\x80\x9C", "\xE2\x80\x9D", "\xE2\x80\x98", "\xE2\x80\x99",
       "\xC2\xAB", "\xC2\xBB", "\xE2\x80\x93", "\xE2\x80\x94", "\xE2\x80\xA6", "\xC2\xA0", "\xEF\xBB\xBF"}) {
    if (t.substr(i).starts_with(s)) return s.size();
  }
  return 0;
}
bool unit(std::string_view t, std::size_t i) {
  return i < t.size() && (is_letter(static_cast<unsigned char>(t[i])) || digit(t[i]) ||
      (static_cast<unsigned char>(t[i]) >= 128 && !special(t, i)));
}
std::vector<Token> tokenize(std::string_view text) {
  std::vector<Token> out;
  for (std::size_t i = 0; i < text.size();) {
    std::size_t j = i + 1;
    if (space(text[i])) {
      while (j < text.size() && space(text[j])) ++j;
      out.push_back({std::string(text.substr(i,j-i)),false,false,false}); i=j; continue;
    }
    // Code and addresses are opaque, including their punctuation. Never rewrite them.
    if (text[i] == '`') {
      while (j < text.size() && text[j] == '`') ++j;
      const auto marker = text.substr(i,j-i);
      const auto end = text.find(marker,j);
      j = end == std::string_view::npos ? text.size() : end + marker.size();
      out.push_back({std::string(text.substr(i,j-i)),false,true,false}); i=j; continue;
    }
    if (is_letter(static_cast<unsigned char>(text[i])) &&
        (i == 0 || !unit(text,i-1))) {
      auto end = text.find_first_of(" \t\r\n<>\"'`", i);
      if (end == std::string_view::npos) end=text.size();
      const auto candidate=text.substr(i,end-i);
      const auto at=candidate.find('@');
      if (candidate.find("://") != std::string_view::npos ||
          lower_copy(candidate).starts_with("www.") || (at != std::string_view::npos && candidate.find('.',at) != std::string_view::npos)) {
        out.push_back({std::string(candidate),false,true,false}); i=end; continue;
      }
    }
    if (auto size = special(text,i)) {
      out.push_back({std::string(text.substr(i,size)),false,true,false}); i+=size; continue;
    }
    if (unit(text,i)) {
      bool word=is_letter(static_cast<unsigned char>(text[i])) || static_cast<unsigned char>(text[i])>=128;
      bool frozen=digit(text[i]) || static_cast<unsigned char>(text[i])>=128;
      j=i+1;
      while (j<text.size()) {
        if (unit(text,j)) {
          word = word || is_letter(static_cast<unsigned char>(text[j])) || static_cast<unsigned char>(text[j])>=128;
          frozen = frozen || digit(text[j]) || static_cast<unsigned char>(text[j])>=128;
          ++j; continue;
        }
        if ((text[j]=='\'' || text[j]=='-' || text[j]=='_') && unit(text,j+1)) {
          frozen = frozen || text[j]=='_'; ++j; continue;
        }
        if (text.substr(j).starts_with("\xE2\x80\x99") && unit(text,j+3)) { frozen=true; j+=3; continue; }
        break;
      }
      out.push_back({std::string(text.substr(i,j-i)),word,frozen && word,false}); i=j; continue;
    }
    out.push_back({std::string(text.substr(i,1)),false,false,false}); ++i;
  }
  return out;
}
bool abbrev(std::string_view w) {
  static const std::unordered_set<std::string_view> list={"mr","mrs","ms","dr","prof","sr","jr","st","vs","etc","eg","ie","am","pm","fig","vol","gen","col","capt","rev","hon","dept","approx"};
  return (w.size()==1 && is_letter(static_cast<unsigned char>(w.front()))) || list.contains(w);
}
bool whitespace(const Token& t) { return !t.word && !t.text.empty() && t.text.find_first_not_of(" \t\r\n")==std::string::npos; }
}

bool update_quotes(std::vector<std::string>& stack, std::string_view token, std::string_view previous) {
  if (!stack.empty() && token==stack.back()) { stack.pop_back(); return true; }
  if (token=="\"" || (token=="'" && !(previous.ends_with('s') || previous.ends_with('S')))) {
    stack.emplace_back(token); return true;
  }
  if (token=="\xE2\x80\x9C") { stack.emplace_back("\xE2\x80\x9D"); return true; }
  if (token=="\xE2\x80\x98") { stack.emplace_back("\xE2\x80\x99"); return true; }
  if (token=="\xC2\xAB") { stack.emplace_back("\xC2\xBB"); return true; }
  return false;
}
std::string concat_tokens(const std::vector<Token>& tokens) {
  std::string out; for (const auto& t:tokens) out+=t.text; return out;
}
std::vector<Piece> split_pieces(std::string_view text) {
  auto tokens=tokenize(text);
  std::vector<Piece> pieces;
  std::vector<Token> current;
  std::vector<std::string> quotes;
  auto flush=[&] {
    if (!current.empty()) {
      Piece p; p.sentence=true; p.text=concat_tokens(current); p.tokens=std::move(current);
      pieces.push_back(std::move(p)); current.clear();
    }
  };
  for (std::size_t i=0;i<tokens.size();++i) {
    const auto& t=tokens[i];
    const std::string_view prev=i ? tokens[i-1].text : std::string_view{};
    update_quotes(quotes,t.text,prev);
    if (quotes.empty() && whitespace(t) && current.empty()) {
      flush(); Piece gap; gap.text=t.text; pieces.push_back(std::move(gap)); continue;
    }
    current.push_back(t);
    if (!quotes.empty() || (t.text!="." && t.text!="!" && t.text!="?")) continue;
    if (i+1<tokens.size() && (tokens[i+1].text=="." || tokens[i+1].text=="!" || tokens[i+1].text=="?")) continue;
    if (t.text=="." && (abbrev(lower_copy(prev)) || (i+1<tokens.size() && !prev.empty() && digit(prev.back()) && !tokens[i+1].text.empty() && digit(tokens[i+1].text.front())))) continue;
    flush();
  }
  flush(); return pieces;
}
}  // namespace synomizer
