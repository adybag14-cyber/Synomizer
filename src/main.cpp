// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "synomizer/engine.hpp"
#include <charconv>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <shellapi.h>
#include <fcntl.h>
#include <io.h>
#endif

namespace {
const char* kind_name(synomizer::ChangeKind kind) {
  switch (kind) {
    case synomizer::ChangeKind::Arrangement: return "arrangement";
    case synomizer::ChangeKind::Article: return "article";
    case synomizer::ChangeKind::Phrase: return "phrase";
    default: return "synonym";
  }
}
void print_help() {
  std::cout << "synomizer " << synomizer::version() << R"HELP(
Deterministic English rewriting with curated synonyms and conservative sentence moves.
Review the result: mechanical rules cannot guarantee semantic equivalence.

Usage: synomizer [options] [file|-]
       synomizer [options] --text TEXT

No file, or a single dash, reads stdin. Input and output are UTF-8.
CRLF and standalone CR line endings are normalized to LF.

Options:
  -s, --seed N           Unsigned 64-bit decimal seed (default 1)
  -i, --intensity N      0 light, 1 standard (default), 2 broader; review all modes
      --synonyms-only    Do not rearrange sentences
      --arrange-only     Do not substitute synonyms
      --no-rewrite       Turn off both operations (normalize line endings only)
      --protect TEXT    Keep a whole word or phrase; repeat for multiple terms
      --vary-quotes      Allow word changes in quotations (never move their structure)
      --show-changes     Print each change on stderr
      --variants N       Offer 1, 2, or 3 distinct rewrites (bounded search)
      --density N        Apply 0..100 percent of eligible word/phrase edits (default 100)
      --mixed-moves      Use a deterministic subset of eligible sentence moves
      --json            Output text and structured change records as JSON
      --text TEXT       Rewrite TEXT instead of a file or stdin
  -o, --output FILE     Write output to FILE
      --                End options; allow a filename beginning with '-'
  -v, --version         Print version
  -h, --help            Print this help
)HELP";
}
std::uint64_t number(std::string_view value, std::string_view name) {
  std::uint64_t out = 0;
  const auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), out);
  if (value.empty() || error != std::errc{} || end != value.data() + value.size())
    throw std::runtime_error(std::string(name) + " must be an unsigned 64-bit decimal integer");
  return out;
}
std::string json_string(std::string_view value) {
  constexpr char hex[] = "0123456789abcdef";
  std::string out = "\"";
  for (unsigned char c : value) {
    switch (c) {
      case '\"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\b': out += "\\b"; break;
      case '\f': out += "\\f"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default:
        if (c < 32) { out += "\\u00"; out += hex[c >> 4]; out += hex[c & 15]; }
        else out += static_cast<char>(c);
    }
  }
  return out + '"';
}
std::string options_json(const synomizer::Options& options) {
  auto boolean = [](bool value) { return value ? "true" : "false"; };
  std::string out = "{\"seed\":" + json_string(std::to_string(options.seed)) +
    ",\"intensity\":" + std::to_string(options.intensity) + ",\"density\":" + std::to_string(options.density) +
    ",\"synonyms\":" + boolean(options.synonyms) + ",\"arrange\":" + boolean(options.arrange) +
    ",\"mixedMoves\":" + boolean(options.mixed_moves) + ",\"protectQuotes\":" + boolean(options.protect_quotes) +
    ",\"protectedTerms\":[";
  bool first = true;
  for (const auto& term : options.protected_terms) { if (!first) out += ','; first = false; out += json_string(term); }
  return out + "]}";
}
std::string to_json(const synomizer::Result& result, const synomizer::Options& options) {
  std::string out = "{\"version\":" + json_string(synomizer::version()) + ",\"seed\":" + json_string(std::to_string(options.seed)) + ",\"options\":" + options_json(options) +
    ",\"text\":" + json_string(result.text) + ",\"changes\":[";
  bool first = true;
  for (const auto& change : result.changes) {
    if (!first) out += ',';
    first = false;
    out += "{\"kind\":" + json_string(kind_name(change.kind)) + ",\"before\":" + json_string(change.before) +
      ",\"after\":" + json_string(change.after) + ",\"detail\":" + json_string(change.detail) + '}';
  }
  return out + "]}\n";
}
int run(const std::vector<std::string>& args) {
  synomizer::Options options;
  bool show_changes=false, json=false, have_text=false, have_file=false, positional=false;
  std::string input_path, output_path, inline_text, mode;
  int count = 1;
  bool multiple = false;
  for (std::size_t i=1; i<args.size(); ++i) {
    const auto& arg=args[i];
    auto value = [&]() -> std::string {
      if (i+1 >= args.size()) throw std::runtime_error("missing value for " + arg);
      return args[++i];
    };
    if (!positional) {
      if (arg=="--") { positional=true; continue; }
      if (arg=="--help" || arg=="-h") { print_help(); return 0; }
      if (arg=="--version" || arg=="-v") { std::cout << "synomizer " << synomizer::version() << '\n'; return 0; }
      if (arg=="--show-changes") { show_changes=true; continue; }
      if (arg=="--mixed-moves") { options.mixed_moves=true; continue; }
      if (arg=="--density") {
        const auto n=number(value(),"density");
        if (n>100) throw std::runtime_error("density must be between 0 and 100");
        options.density=static_cast<int>(n); continue;
      }
      if (arg=="--variants") {
        const auto n=number(value(),"variation count");
        if (n<1 || n>3) throw std::runtime_error("variation count must be 1, 2, or 3");
        count=static_cast<int>(n); multiple=true; continue;
      }
      if (arg=="--json") { json=true; continue; }
      if (arg=="--vary-quotes") { options.protect_quotes=false; continue; }
      if (arg=="--seed" || arg=="-s") { options.seed=number(value(),"seed"); continue; }
      if (arg=="--intensity" || arg=="-i") {
        const auto n=number(value(),"intensity");
        if (n>2) throw std::runtime_error("intensity must be 0, 1, or 2");
        options.intensity=static_cast<int>(n); continue;
      }
      if (arg=="--protect") {
        const auto term=value();
        if (term.find_first_not_of(" \t\n\r")==std::string::npos) throw std::runtime_error("protected term cannot be empty");
        options.protected_terms.push_back(term); continue;
      }
      if (arg=="--output" || arg=="-o") {
        output_path=value();
        if (output_path.empty()) throw std::runtime_error("output filename cannot be empty");
        continue;
      }
      if (arg=="--text") {
        if (have_text) throw std::runtime_error("--text may be specified only once");
        inline_text=value(); have_text=true; continue;
      }
      if (arg=="--synonyms-only" || arg=="--arrange-only" || arg=="--no-rewrite") {
        if (!mode.empty() && mode!=arg) throw std::runtime_error("choose only one rewrite mode");
        mode=arg; continue;
      }
      if (arg!="-" && arg.starts_with('-')) throw std::runtime_error("unknown option " + arg);
    }
    if (have_file) throw std::runtime_error("only one input file is allowed");
    input_path=arg; have_file=true;
  }
  if (have_text && have_file) throw std::runtime_error("use either --text or a file, not both");
  if (mode=="--no-rewrite") { options.synonyms=false; options.arrange=false; }
  else if (mode=="--synonyms-only") options.arrange=false;
  else if (mode=="--arrange-only") options.synonyms=false;
  std::string input;
  if (have_text) input=inline_text;
  else {
    std::ifstream file;
    std::istream* stream=&std::cin;
    if (have_file && input_path!="-") {
      file.open(std::filesystem::path(std::u8string(input_path.begin(), input_path.end())),std::ios::binary);
      if (!file) throw std::runtime_error("could not read " + input_path);
      stream=&file;
    }
    std::ostringstream buffer;
    buffer << stream->rdbuf();
    if (stream->bad()) throw std::runtime_error("input read failed");
    input=buffer.str();
  }
  std::string rendered;
  auto log_changes = [&](const synomizer::Result& result) {
    if (show_changes) for (const auto& c : result.changes)
      std::cerr << '[' << kind_name(c.kind) << "] " << c.before << " => " << c.after << " (" << c.detail << ")\n";
  };
  if (!multiple) {
    const auto result = synomizer::rewrite(input, options);
    log_changes(result);
    rendered = json ? to_json(result, options) : result.text;
  } else {
    const auto set = synomizer::rewrite_variations(input, options, count);
    if (json) rendered = "{\"version\":" + json_string(synomizer::version()) + ",\"requested\":" + std::to_string(count) +
      ",\"candidatesConsidered\":" + std::to_string(set.candidates_considered) + ",\"variations\":[";
    else rendered = "Found " + std::to_string(set.variations.size()) + " distinct result(s) in " +
      std::to_string(set.candidates_considered) + " candidate(s). Review meaning before use.\n\n";
    for (std::size_t i = 0; i < set.variations.size(); ++i) {
      const auto& variant = set.variations[i];
      if (show_changes) std::cerr << "Variation " << i+1 << ":\n";
      log_changes(variant.result);
      if (json) {
        if (i) rendered += ',';
        auto item = to_json(variant.result, variant.options); item.pop_back(); rendered += item;
      } else {
        rendered += "--- Variation " + std::to_string(i+1) + " (seed " + std::to_string(variant.options.seed) +
          ", density " + std::to_string(variant.options.density) + "%) ---\n" + variant.result.text + "\n\n";
      }
    }
    if (json) rendered += "]}\n";
  }
  if (output_path.empty()) {
    std::cout << rendered;
    std::cout.flush();
    if (!std::cout) throw std::runtime_error("output write failed");
  } else {
    std::ofstream file(std::filesystem::path(std::u8string(output_path.begin(), output_path.end())),std::ios::binary);
    if (!file) throw std::runtime_error("could not write " + output_path);
    file << rendered;
    file.close();
    if (!file) throw std::runtime_error("output write failed for " + output_path);
  }
  return 0;
}
} // namespace

int main(int argc,char** argv) {
  try {
    std::vector<std::string> args;
#ifdef _WIN32
    _setmode(_fileno(stdin),_O_BINARY);
    _setmode(_fileno(stdout),_O_BINARY);
    _setmode(_fileno(stderr),_O_BINARY);
    // The narrow CRT argv uses the system code page; obtain UTF-8 explicitly.
    (void)argc; (void)argv;
    int count=0;
    auto wide=CommandLineToArgvW(GetCommandLineW(),&count);
    if (!wide) throw std::runtime_error("could not decode command line");
    for (int i=0; i<count; ++i) {
      const int bytes=WideCharToMultiByte(CP_UTF8,0,wide[i],-1,nullptr,0,nullptr,nullptr);
      std::string arg(static_cast<std::size_t>(bytes),'\0');
      WideCharToMultiByte(CP_UTF8,0,wide[i],-1,arg.data(),bytes,nullptr,nullptr);
      if (!arg.empty()) arg.pop_back();
      args.push_back(std::move(arg));
    }
    LocalFree(wide);
#else
    for (int i=0; i<argc; ++i) args.emplace_back(argv[i]);
#endif
    return run(args);
  } catch (const std::exception& e) {
    std::cerr << "synomizer: " << e.what() << '\n';
    return 1;
  }
}
