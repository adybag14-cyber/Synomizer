// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

#include "synomizer/engine.hpp"

#include <cstdint>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>

#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif

namespace {

void print_help() {
  std::cout
      << "synomizer " << synomizer::version()
      << "\n"
         "Rewrite English text with grammatical synonyms and safe clause moves.\n"
         "\n"
         "Usage: synomizer [options] [file]\n"
         "       synomizer [options] --text TEXT\n"
         "\n"
         "With no file and no --text, synomizer reads stdin.\n"
         "The same text and --seed always produce the same wording.\n"
         "\n"
         "Options:\n"
         "  -s, --seed N           Choice seed (default 1)\n"
         "  -i, --intensity N      0 adjectives and manner adverbs, 1 safe words, 2 also narrower words\n"
         "      --synonyms-only    Do not rearrange clauses, adverbs, or adjectives\n"
         "      --arrange-only     Do not substitute synonyms\n"
         "      --show-changes     Print each substitution and move on stderr\n"
         "      --vary-quotes      Also rewrite words inside quotation marks\n"
         "  -o, --output FILE      Write the rewrite to FILE instead of stdout\n"
         "      --text TEXT        Rewrite TEXT instead of a file or stdin\n"
         "  -v, --version          Print the version\n"
         "  -h, --help             Print this help\n";
}

void print_changes(const synomizer::Result& result) {
  for (const synomizer::Change& change : result.changes) {
    const char* kind = "synonym";
    if (change.kind == synomizer::ChangeKind::Arrangement) {
      kind = "arrangement";
    } else if (change.kind == synomizer::ChangeKind::Article) {
      kind = "article";
    }
    std::cerr << "[" << kind << "] " << change.before << " => " << change.after;
    if (!change.detail.empty()) {
      std::cerr << " (" << change.detail << ")";
    }
    std::cerr << "\n";
  }
}

}  // namespace

int main(int argc, char** argv) {
#ifdef _WIN32
  // Text mode would turn the engine's LF bytes into CRLF on the way out.
  _setmode(_fileno(stdin), _O_BINARY);
  _setmode(_fileno(stdout), _O_BINARY);
  _setmode(_fileno(stderr), _O_BINARY);
#endif
  synomizer::Options options;
  bool show_changes = false;
  bool synonyms_only = false;
  bool arrange_only = false;
  std::string output_path;
  std::string input_path;
  std::string inline_text;
  bool have_text = false;

  for (int i = 1; i < argc; ++i) {
    const std::string arg = argv[i];
    auto need_value = [&](const char* name) -> const char* {
      if (i + 1 >= argc) {
        std::cerr << "synomizer: missing value for " << name << "\n";
        return nullptr;
      }
      return argv[++i];
    };
    if (arg == "-h" || arg == "--help") {
      print_help();
      return 0;
    }
    if (arg == "-v" || arg == "--version") {
      std::cout << "synomizer " << synomizer::version() << "\n";
      return 0;
    }
    if (arg == "--show-changes") {
      show_changes = true;
      continue;
    }
    if (arg == "--synonyms-only") {
      synonyms_only = true;
      continue;
    }
    if (arg == "--arrange-only") {
      arrange_only = true;
      continue;
    }
    if (arg == "--vary-quotes") {
      options.protect_quotes = false;
      continue;
    }
    if (arg == "-s" || arg == "--seed") {
      const char* value = need_value("--seed");
      if (value == nullptr) {
        return 1;
      }
      try {
        options.seed = static_cast<std::uint64_t>(std::stoull(value));
      } catch (const std::exception&) {
        std::cerr << "synomizer: seed must be an integer\n";
        return 1;
      }
      continue;
    }
    if (arg == "-i" || arg == "--intensity") {
      const char* value = need_value("--intensity");
      if (value == nullptr) {
        return 1;
      }
      try {
        options.intensity = std::stoi(value);
      } catch (const std::exception&) {
        std::cerr << "synomizer: intensity must be 0, 1, or 2\n";
        return 1;
      }
      if (options.intensity < 0 || options.intensity > 2) {
        std::cerr << "synomizer: intensity must be 0, 1, or 2\n";
        return 1;
      }
      continue;
    }
    if (arg == "-o" || arg == "--output") {
      const char* value = need_value("--output");
      if (value == nullptr) {
        return 1;
      }
      output_path = value;
      continue;
    }
    if (arg == "--text") {
      const char* value = need_value("--text");
      if (value == nullptr) {
        return 1;
      }
      inline_text = value;
      have_text = true;
      continue;
    }
    if (arg.starts_with('-')) {
      std::cerr << "synomizer: unknown option " << arg << "\n";
      return 1;
    }
    if (!input_path.empty()) {
      std::cerr << "synomizer: only one input file is allowed\n";
      return 1;
    }
    input_path = arg;
  }

  if (have_text && !input_path.empty()) {
    std::cerr << "synomizer: use either --text or a file, not both\n";
    return 1;
  }
  if (synonyms_only && arrange_only) {
    options.synonyms = true;
    options.arrange = true;
  } else if (synonyms_only) {
    options.arrange = false;
  } else if (arrange_only) {
    options.synonyms = false;
  }

  std::string input;
  if (have_text) {
    input = std::move(inline_text);
  } else if (!input_path.empty()) {
    std::ifstream in(input_path, std::ios::binary);
    if (!in) {
      std::cerr << "synomizer: could not read " << input_path << "\n";
      return 1;
    }
    std::ostringstream buffer;
    buffer << in.rdbuf();
    input = buffer.str();
  } else {
    std::ostringstream buffer;
    buffer << std::cin.rdbuf();
    input = buffer.str();
  }

  const synomizer::Result result = synomizer::rewrite(input, options);
  if (show_changes) {
    print_changes(result);
  }
  if (output_path.empty()) {
    std::cout << result.text;
    return 0;
  }
  std::ofstream out(output_path, std::ios::binary);
  if (!out) {
    std::cerr << "synomizer: could not write " << output_path << "\n";
    return 1;
  }
  out << result.text;
  return out ? 0 : 1;
}
