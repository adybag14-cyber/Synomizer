// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "internal.hpp"
#include <array>
#include <algorithm>
#include <bit>
#include <cstdint>

namespace synomizer {
std::string sha256_text(std::string_view text) {
  constexpr std::array<std::uint32_t,64> k={
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2};
  std::array<std::uint32_t,8> h={0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19};
  const auto blocks=text.size()/64+((text.size()%64)<56?1:2);
  const auto bits=static_cast<std::uint64_t>(text.size())*8;
  for(std::size_t block=0;block<blocks;++block) {
    std::array<std::uint32_t,64> w{};
    for(std::size_t i=0;i<64;++i) {
      const auto pos=block*64+i;
      const auto byte=pos<text.size()?static_cast<unsigned char>(text[pos]):pos==text.size()?128u:
        (block+1==blocks && i>=56)?static_cast<unsigned>((bits>>((63-i)*8))&255u):0u;
      w[i/4]|=static_cast<std::uint32_t>(byte)<<(24-(i%4)*8);
    }
    for(std::size_t i=16;i<64;++i) {
      const auto x=w[i-15],y=w[i-2];
      w[i]=w[i-16]+(std::rotr(x,7)^std::rotr(x,18)^(x>>3))+w[i-7]+(std::rotr(y,17)^std::rotr(y,19)^(y>>10));
    }
    auto [a,b,c,d,e,f,g,z]=h;
    for(std::size_t i=0;i<64;++i) {
      const auto t1=z+(std::rotr(e,6)^std::rotr(e,11)^std::rotr(e,25))+((e&f)^(~e&g))+k[i]+w[i];
      const auto t2=(std::rotr(a,2)^std::rotr(a,13)^std::rotr(a,22))+((a&b)^(a&c)^(b&c));
      z=g;g=f;f=e;e=d+t1;d=c;c=b;b=a;a=t1+t2;
    }
    const std::array<std::uint32_t,8> next={a,b,c,d,e,f,g,z};
    for(std::size_t i=0;i<8;++i) h[i]+=next[i];
  }
  constexpr char digits[]="0123456789abcdef";
  std::string out;out.reserve(64);
  for(auto word:h) for(int i=28;i>=0;i-=4) out+=digits[(word>>i)&15];
  return out;
}
std::vector<std::string> source_anchors(std::string_view text) {
  std::vector<std::string> out;
  const auto logical=[](std::string_view w){return w=="not"||w=="no"||w=="never"||w=="can"||w=="could"||w=="may"||w=="might"||w=="must"||w=="shall"||w=="should"||w=="will"||w=="would"||w=="only"||w=="or"||w=="either"||w=="neither";};
  for(std::size_t i=0;i<text.size();) {
    const auto c=static_cast<unsigned char>(text[i]);
    if(c>='0'&&c<='9') {
      auto j=i+1;
      while(j<text.size()) {
        if(text[j]>='0'&&text[j]<='9'){++j;continue;}
        if((text[j]=='.'||text[j]==',')&&j+1<text.size()&&text[j+1]>='0'&&text[j+1]<='9'){++j;continue;}
        break;
      }
      out.push_back("n:"+std::string(text.substr(i,j-i)));i=j;continue;
    }
    if(is_letter(c)) {
      auto j=i+1;while(j<text.size()&&(is_letter(static_cast<unsigned char>(text[j]))||(text[j]=='\''&&j+1<text.size()&&is_letter(static_cast<unsigned char>(text[j+1])))))++j;
      auto w=lower_copy(text.substr(i,j-i));
      if(w=="cannot"||w=="can't") {out.push_back("w:can");out.push_back("w:not");}
      else if(w=="won't") {out.push_back("w:will");out.push_back("w:not");}
      else if(w.ends_with("n't")) {out.push_back("w:not");w.resize(w.size()-3);if(logical(w))out.push_back("w:"+w);}
      else if(logical(w))out.push_back("w:"+w);
      i=j;continue;
    }
    ++i;
  }
  std::sort(out.begin(),out.end());return out;
}
void assess_conformity(std::string_view source,const Options& o,Result& result) {
  auto& report=*result.standards;
  auto& c=report.conformity;
  c.strict_requested=o.require_conformity;
  c.marker_check="matched";
  for(const auto& f:report.findings) if(f.code=="CONVERSION-ROLLBACK")c.marker_check="mismatch-rolled-back";
  c.source_sha256=sha256_text(source);c.draft_sha256=sha256_text(result.text);
  c.blockers.push_back("Meaning, facts, actors and obligations have not received a complete source-to-draft assessment.");
  if(o.profile=="ste" || o.profile=="combined") {
    c.blockers.push_back(o.vocabulary.empty()?"An authorized STE vocabulary and reviewed technical terminology have not been supplied.":"Supplied vocabulary authority, completeness, word senses, grammatical roles and forms have not been verified.");
    c.blockers.push_back("The complete ASD-STE100 Issue 9 requirements are not automatically verified. Rule inventory coverage is not compliance.");
    // Issue 9 has 53 rules. Old rule 2.3 is not an Issue 9 rule.
    constexpr std::array<int,9> limits={14,2,7,5,5,6,3,7,4};
    for(int section=1;section<=9;++section) for(int n=1;n<=limits[section-1];++n) {
      const auto id=std::to_string(section)+"."+std::to_string(n);
      bool screened=id=="3.2" || id=="3.5" || id=="3.6" || id=="5.1" || id=="6.3" || id=="8.1" || id=="8.4" || id=="8.5" || id=="8.6";
      bool attention=false;
      for(const auto& f:report.findings) if(f.code=="STE-"+id) attention=true;
      c.requirements.push_back({"ASD-STE100 Issue 9",id,screened?"partial-screen":"human-review",attention?"attention":"not-verified",
        screened?"A bounded screen assists review; absence of findings does not verify the full rule.":"Review this rule against the authorized standard and the actual document. No automated approval."});
    }
  }
  if(o.profile=="plain" || o.profile=="combined") {
    c.blockers.push_back("Reader relevance, document organization, understanding and usability need evidence from the intended audience and author review.");
    for(const auto* principle:{"relevant","findable","understandable","usable"})
      c.requirements.push_back({"ISO 24495-1:2023",principle,"human-review","not-verified","Principle-level review item, not a complete inventory of the standard's guidelines or a certification."});
  }
  if(report.after.sentences==0)c.blockers.push_back("No assessable prose was found; empty or opaque input cannot establish conformity.");
  if(report.after.long_sentences)c.blockers.push_back("Some count units exceed the selected screening target; review their structure and grouping.");
  if(report.after.unlisted_words)c.blockers.push_back("Some words were not found in the supplied vocabulary.");
  // Deliberately no caller-supplied switch or number of passing tests can set
  // release_allowed/conformity_verified. A separate complete assessment is absent.
}
} // namespace synomizer
