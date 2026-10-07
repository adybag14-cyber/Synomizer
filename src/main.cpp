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
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <shellapi.h>
#include <fcntl.h>
#include <io.h>
#endif
namespace {
std::filesystem::path utf8_path(const std::string& text) {
  return std::filesystem::path(std::u8string(text.begin(),text.end()));
}

const char* kind(synomizer::ChangeKind k) {
  switch(k) {
    case synomizer::ChangeKind::Arrangement: return "arrangement";
    case synomizer::ChangeKind::Article: return "article";
    default: return "synonym";
  }
}
std::string json_string(std::string_view s) {
  constexpr char hex[]="0123456789abcdef";
  std::string out="\"";
  for (unsigned char c:s) {
    if(c=='"' || c=='\\') {out+='\\';out+=static_cast<char>(c);}
    else if(c<32) {out+="\\u00";out+=hex[c>>4];out+=hex[c&15];}
    else out+=static_cast<char>(c);
  }
  return out+'"';
}
std::string json_result(const synomizer::Result& r) {
  std::string out="{\"text\":"+json_string(r.text)+",\"changes\":[";
  bool first=true;
  for(const auto& c:r.changes) {
    if(!first) out+=',';
    first=false;
    out+="{\"kind\":"+json_string(kind(c.kind))+",\"before\":"+json_string(c.before)+
      ",\"after\":"+json_string(c.after)+",\"detail\":"+json_string(c.detail)+"}";
  }
  return out+"]}\n";
}
std::uint64_t number(std::string_view s, const char* name) {
  std::uint64_t value=0;
  const auto parsed=std::from_chars(s.data(),s.data()+s.size(),value);
  if(s.empty() || parsed.ec!=std::errc{} || parsed.ptr!=s.data()+s.size())
    throw std::runtime_error(std::string(name)+" must be an unsigned 64-bit integer");
  return value;
}
std::string read_stream(std::istream& in) {
  std::ostringstream out;
  out<<in.rdbuf();
  if(in.bad()) throw std::runtime_error("could not read input");
  return out.str();
}
void help() {
  std::cout<<"synomizer "<<synomizer::version()<<R"(
Rewrite English text using conservative synonym and sentence-movement rules.
Review the output: a rule-based tool cannot guarantee semantic equivalence.

Usage: synomizer [options] [file|-]
       synomizer [options] --text TEXT

Input defaults to stdin; output defaults to stdout. Files use UTF-8.
The same text, options and seed produce the same output. Line endings are kept.

  -s, --seed N          Unsigned 64-bit seed (default: 1)
  -i, --intensity N     0 adjectives/manner, 1 standard, 2 narrower words
      --synonyms-only  Disable sentence moves
      --arrange-only   Disable synonyms
      --no-synonyms    Disable synonyms (can combine with --no-arrange)
      --no-arrange     Disable sentence moves
      --vary-quotes    Allow synonym changes inside quotations
      --show-changes   Print the change ledger to stderr
      --json           Emit JSON containing text and the change ledger
      --text TEXT      Read literal text instead of a file or stdin
  -o, --output FILE    Output file, or - for stdout
      --               End options (for filenames beginning with -)
  -v, --version        Print the version
  -h, --help           Print this help
)";
}
}
int main(int argc,char** argv) {
#ifdef _WIN32
  _setmode(_fileno(stdin),_O_BINARY);
  _setmode(_fileno(stdout),_O_BINARY);
  _setmode(_fileno(stderr),_O_BINARY);
#endif
  try {
    std::vector<std::string> args;
#ifdef _WIN32
    // argv uses the Windows ANSI code page; decode the actual Unicode command line.
    int count=0;
    auto wide=CommandLineToArgvW(GetCommandLineW(),&count);
    if(!wide) throw std::runtime_error("could not decode command line");
    for(int i=1;i<count;++i) {
      const int size=WideCharToMultiByte(CP_UTF8,0,wide[i],-1,nullptr,0,nullptr,nullptr);
      std::string value(static_cast<std::size_t>(size), '\0');
      WideCharToMultiByte(CP_UTF8,0,wide[i],-1,value.data(),size,nullptr,nullptr);
      if(!value.empty()) value.pop_back();
      args.push_back(std::move(value));
    }
    LocalFree(wide);
    (void)argc; (void)argv;
#else
    for(int i=1;i<argc;++i) args.emplace_back(argv[i]);
#endif
    synomizer::Options options;
    bool show=false, json=false, have_text=false, have_file=false, end_options=false;
    bool only_syn=false,only_arr=false;
    std::string text,path,output;
    for(std::size_t i=0;i<args.size();++i) {
      const auto& arg=args[i];
      auto value=[&]() -> const std::string& {
        if(i+1==args.size()) throw std::runtime_error("missing value for "+arg);
        return args[++i];
      };
      if(!end_options) {
        if(arg=="--") {end_options=true;continue;}
        if(arg=="--help" || arg=="-h") {help();return 0;}
        if(arg=="--version" || arg=="-v") {std::cout<<"synomizer "<<synomizer::version()<<'\n';return 0;}
        if(arg=="--seed" || arg=="-s") {options.seed=number(value(),"seed");continue;}
        if(arg=="--intensity" || arg=="-i") {
          const auto n=number(value(),"intensity");
          if(n>2) throw std::runtime_error("intensity must be 0, 1, or 2");
          options.intensity=static_cast<int>(n);continue;
        }
        if(arg=="--show-changes") {show=true;continue;}
        if(arg=="--json") {json=true;continue;}
        if(arg=="--synonyms-only") {only_syn=true;continue;}
        if(arg=="--arrange-only") {only_arr=true;continue;}
        if(arg=="--no-synonyms") {options.synonyms=false;continue;}
        if(arg=="--no-arrange") {options.arrange=false;continue;}
        if(arg=="--vary-quotes") {options.protect_quotes=false;continue;}
        if(arg=="--output" || arg=="-o") {output=value();continue;}
        if(arg=="--text") {
          if(have_text) throw std::runtime_error("--text may only be supplied once");
          text=value();have_text=true;continue;
        }
        if(arg.starts_with('-') && arg!="-") throw std::runtime_error("unknown option "+arg);
      }
      if(have_file) throw std::runtime_error("only one input file is allowed");
      path=arg;have_file=true;
    }
    if(have_text && have_file) throw std::runtime_error("use either --text or a file, not both");
    if(only_syn && only_arr) throw std::runtime_error("--synonyms-only and --arrange-only conflict");
    if(only_syn) options.arrange=false;
    if(only_arr) options.synonyms=false;
    if(!have_text) {
      if(!have_file || path=="-") text=read_stream(std::cin);
      else {
        std::ifstream in(utf8_path(path),std::ios::binary);
        if(!in) throw std::runtime_error("could not read "+path);
        text=read_stream(in);
      }
    }
    const auto result=synomizer::rewrite(text,options);
    if(show) for(const auto& c:result.changes)
      std::cerr<<'['<<kind(c.kind)<<"] "<<c.before<<" => "<<c.after<<(c.detail.empty()?"":" ("+c.detail+")")<<'\n';
    const auto bytes=json?json_result(result):result.text;
    if(output.empty() || output=="-") {
      std::cout<<bytes; std::cout.flush();
      if(!std::cout) throw std::runtime_error("could not write stdout");
    } else {
      std::ofstream out(utf8_path(output),std::ios::binary);
      if(!out) throw std::runtime_error("could not write "+output);
      out<<bytes;out.flush();
      if(!out) throw std::runtime_error("could not write "+output);
    }
    return 0;
  } catch(const std::exception& e) {
    std::cerr<<"synomizer: "<<e.what()<<'\n'; return 1;
  }
}
