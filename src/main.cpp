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
      --json            Output text and structured change records as JSON
      --variants N      Offer 1..3 distinct rewrites (default 1; no duplicates)
      --style NAME      Single-rewrite profile: balanced, close, or recast
      --profile NAME    variation (default), ste, plain, or combined; standards give one draft
      --text-type NAME  description (default) or procedure; selects STE length screen
      --require-conformity  Withhold text/output file and exit 3 unless conformity is established
      --no-structured-lists  Do not format supported enumerations as vertical lists
      --check-only      No edits; output JSON review report (requires standards profile)
      --audience TEXT   Intended readers (context for human plain-language review)
      --purpose TEXT    Reader task/purpose (not a verified assessment)
      --vocabulary FILE User-authorized TSV: term, pos, meaning, category; no standard dictionary bundled
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
std::string metrics_json(const synomizer::StandardMetrics& m) {
  return "{\"sentences\":"+std::to_string(m.sentences)+",\"words\":"+std::to_string(m.words)+
    ",\"longestSentence\":"+std::to_string(m.longest_sentence)+",\"longSentences\":"+std::to_string(m.long_sentences)+
    ",\"possiblePassives\":"+std::to_string(m.possible_passives)+",\"unlistedWords\":"+std::to_string(m.unlisted_words)+"}";
}
std::string conformity_json(const synomizer::ConformityAssessment& c) {
  auto out="{\"decision\":"+json_string(c.decision)+",\"releaseAllowed\":false,\"conformityVerified\":false,\"strictRequested\":"+(c.strict_requested?"true":"false")+
    ",\"sourceSha256\":"+json_string(c.source_sha256)+",\"draftSha256\":"+json_string(c.draft_sha256)+",\"normalization\":\"LF\",\"markerCheck\":"+json_string(c.marker_check)+",\"blockers\":[";
  bool first=true;
  for(const auto& b:c.blockers){if(!first)out+=',';first=false;out+=json_string(b);}
  out+="],\"requirements\":[";first=true;
  for(const auto& r:c.requirements){if(!first)out+=',';first=false;out+="{\"standard\":"+json_string(r.standard)+",\"rule\":"+json_string(r.rule)+",\"method\":"+json_string(r.method)+",\"result\":"+json_string(r.result)+",\"note\":"+json_string(r.note)+"}";}
  return out+"]}";
}
std::string standards_json(const synomizer::StandardsReport& r) {
  auto out="{\"profile\":"+json_string(r.profile)+",\"textType\":"+json_string(r.text_type)+
    ",\"status\":"+json_string(r.status)+",\"audience\":"+json_string(r.audience)+",\"purpose\":"+json_string(r.purpose)+
    ",\"sentenceTarget\":"+std::to_string(r.sentence_target)+",\"vocabularyEntries\":"+std::to_string(r.vocabulary_entries)+
    ",\"estimatedCounts\":true,\"semanticEquivalenceVerified\":false,\"before\":"+metrics_json(r.before)+
    ",\"after\":"+metrics_json(r.after)+",\"findings\":[";
  bool first=true;
  for(const auto& f:r.findings) {
    if(!first) out+=',';
    first=false;
    out+="{\"code\":"+json_string(f.code)+",\"severity\":"+json_string(f.severity)+",\"message\":"+json_string(f.message)+
      ",\"evidence\":"+json_string(f.evidence)+",\"sentence\":"+std::to_string(f.sentence)+"}";
  }
  return out+"],\"conformity\":"+conformity_json(r.conformity)+"}";
}
std::string to_json(const synomizer::Result& result, std::uint64_t seed, synomizer::Style style) {
  std::string out = "{\"version\":" + json_string(synomizer::version()) + ",\"seed\":" + json_string(std::to_string(seed)) +
    ",\"style\":" + json_string(synomizer::style_name(style)) + ",\"text\":" + json_string(result.text) + ",\"changes\":[";
  bool first = true;
  for (const auto& change : result.changes) {
    if (!first) out += ',';
    first = false;
    out += "{\"kind\":" + json_string(kind_name(change.kind)) + ",\"before\":" + json_string(change.before) +
      ",\"after\":" + json_string(change.after) + ",\"detail\":" + json_string(change.detail) + '}';
  }
  out += ']';
  if (result.standards) out += ",\"standards\":" + standards_json(*result.standards);
  return out + "}\n";
}
int run(const std::vector<std::string>& args) {
  synomizer::Options options;
  std::size_t count = 1;
  bool show_changes=false, json=false, have_text=false, have_file=false, positional=false;
  std::string input_path, output_path, inline_text, mode, vocabulary_path;
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
      if (arg=="--json") { json=true; continue; }
      if (arg=="--profile") {
        options.profile=value();
        if (options.profile!="variation" && options.profile!="ste" && options.profile!="plain" && options.profile!="combined") throw std::runtime_error("profile must be variation, ste, plain, or combined");
        continue;
      }
      if (arg=="--text-type") {
        options.text_type=value();
        if (options.text_type!="description" && options.text_type!="procedure") throw std::runtime_error("text type must be description or procedure");
        continue;
      }
      if (arg=="--check-only") { options.check_only=true; json=true; continue; }
      if (arg=="--require-conformity") { options.require_conformity=true; continue; }
      if (arg=="--no-structured-lists") { options.structured_lists=false; continue; }
      if (arg=="--audience") { options.audience=value(); continue; }
      if (arg=="--purpose") { options.purpose=value(); continue; }
      if (arg=="--vocabulary") { vocabulary_path=value(); if(vocabulary_path.empty()) throw std::runtime_error("vocabulary filename cannot be empty"); continue; }
      if (arg=="--vary-quotes") { options.protect_quotes=false; continue; }
      if (arg=="--seed" || arg=="-s") { options.seed=number(value(),"seed"); continue; }
      if (arg=="--variants") {
        const auto n=number(value(),"variants");
        if (n<1 || n>3) throw std::runtime_error("variants must be 1, 2, or 3");
        count=static_cast<std::size_t>(n); continue;
      }
      if (arg=="--style") {
        const auto name=value();
        if (name=="balanced") options.style=synomizer::Style::Balanced;
        else if (name=="close") options.style=synomizer::Style::Close;
        else if (name=="recast") options.style=synomizer::Style::Recast;
        else throw std::runtime_error("style must be balanced, close, or recast");
        continue;
      }
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
  if (!vocabulary_path.empty()) {
    std::ifstream file(std::filesystem::path(std::u8string(vocabulary_path.begin(),vocabulary_path.end())),std::ios::binary);
    if (!file) throw std::runtime_error("could not read vocabulary " + vocabulary_path);
    std::string tsv; char buffer[4096];
    while (file.read(buffer,sizeof(buffer)) || file.gcount()) {
      tsv.append(buffer,static_cast<std::size_t>(file.gcount()));
      if (tsv.size()>1000000) throw std::runtime_error("vocabulary input limit is 1000000 UTF-8 bytes");
    }
    if(file.bad()) throw std::runtime_error("vocabulary read failed");
    options.vocabulary=synomizer::parse_vocabulary(tsv);
  }
  const auto batch=synomizer::rewrite_variants(input,options,count);
  std::string rendered;
  if (json && count>1) rendered="{\"version\":"+json_string(synomizer::version())+",\"seed\":"+json_string(std::to_string(options.seed))+
    ",\"requested\":"+std::to_string(batch.requested)+",\"attempts\":"+std::to_string(batch.attempts)+",\"variants\":[";
  for (std::size_t i=0; i<batch.variants.size(); ++i) {
    const auto& variant=batch.variants[i];
    if (show_changes) {
      if (count>1) std::cerr << "Variation " << i+1 << " / " << synomizer::style_name(variant.style) << " / seed " << variant.seed << '\n';
      for (const auto& c:variant.result.changes)
        std::cerr << '[' << kind_name(c.kind) << "] " << c.before << " => " << c.after << " (" << c.detail << ")\n";
    }
    if (json) {
      if (i) rendered+=',';
      rendered+=to_json(variant.result,variant.seed,variant.style);
    } else {
      if (count>1) rendered+="=== Variation "+std::to_string(i+1)+" / "+std::string(synomizer::style_name(variant.style))+" / seed "+std::to_string(variant.seed)+" ===\n";
      rendered+=variant.result.text;
      if (count>1) rendered+="\n\n";
    }
  }
  if (json && count>1) rendered+="]}\n";
  if (count>1 && batch.variants.size()<count && !json)
    std::cerr << "synomizer: only " << batch.variants.size() << " distinct result(s) found; protection settings were not relaxed.\n";
  if (options.profile!="variation" && !json) std::cerr << "synomizer: authoring draft; full conformance and meaning are not verified. Use --json for the review report.\n";
  if (options.require_conformity) {
    bool blocked=false;
    for(const auto& v:batch.variants) if(!v.result.standards || !v.result.standards->conformity.release_allowed) blocked=true;
    if(blocked) {
      // Never create/truncate a requested output file on failed release.
      // Explicit JSON on stdout is a diagnostic draft report, not released text.
      if(json && output_path.empty()) { std::cout<<rendered; std::cout.flush(); if(!std::cout) throw std::runtime_error("report write failed"); }
      std::cerr<<"synomizer: conformity release blocked; requirements remain unverified. No final text file was written. Use --json without --output to inspect the draft report.\n";
      return 3;
    }
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
