// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "synomizer/engine.hpp"
#include <iostream>
#include <stdexcept>
#include <unordered_set>
int main() {
  using namespace synomizer;
  int failures=0;
  const auto expect=[&](bool condition,const char* message) { if(!condition){++failures;std::cerr<<message<<'\n';} };
  // Keep existing 1.1 aggregate initializers source-compatible.
  Options legacy{1,1,true,true,true,{"Alice"}};
  expect(legacy.style==Style::Balanced,"legacy Options initializer");
  const std::string input="In addition, the teacher gave a clear explanation. She carefully examined the report. They retained the documents in order to verify the details.";
  const auto batch=rewrite_variants(input,legacy);
  expect(batch.variants.size()==3,"three distinct candidates");
  expect(batch.requested==3 && batch.attempts<=12,"bounded search");
  std::unordered_set<std::string> unique;
  for(const auto& variant:batch.variants) {
    unique.insert(variant.result.text);
    Options settings=legacy;settings.seed=variant.seed;settings.style=variant.style;
    expect(rewrite(input,settings).text==variant.result.text,"candidate reproduces from original");
    if(variant.style==Style::Close)for(const auto& change:variant.result.changes)
      expect(change.kind!=ChangeKind::Arrangement && change.kind!=ChangeKind::Phrase,"light touch does not move structure");
  }
  expect(unique.size()==batch.variants.size(),"no duplicates");
  for(const auto count:{0u,4u}){
    bool rejected=false;
    try{(void)rewrite_variants(input,legacy,count);}catch(const std::invalid_argument&){rejected=true;}
    expect(rejected,"invalid candidate count rejected");
  }
  const auto trivial=rewrite_variants("xyzzy");
  expect(trivial.variants.size()==1 && trivial.variants[0].result.text=="xyzzy","unrewritable text preserved");
  legacy.synonyms=false;legacy.arrange=false;
  const auto off=rewrite_variants(input,legacy);
  expect(off.variants.size()==1 && off.attempts==1 && off.variants[0].result.text==input,"disabled operations fast path");
  std::uint64_t state=42;
  constexpr std::string_view alphabet="abcXYZ '.,?![]()\n\t123";
  for(int trial=0;trial<100;++trial) {
    std::string text;
    for(int j=0;j<100;++j) { state=state*6364136223846793005ULL+1; text+=alphabet[state%alphabet.size()]; }
    const auto stress=rewrite_variants(text);
    expect(!stress.variants.empty() && stress.variants.size()<=3 && stress.attempts<=12,"bounded malformed-input stress");
    for(const auto& v:stress.variants) {
      Options settings;settings.seed=v.seed;settings.style=v.style;
      expect(rewrite(text,settings).text==v.result.text,"stress replay from original");
    }
  }
  expect(rewrite("The aircraft were ready.").text=="The airplanes were prepared.","plural aircraft agreement");
  expect(rewrite("An aircraft was ready.").text=="An airplane was prepared.","singular aircraft agreement");
  expect(rewrite("She worked in a careful manner.").text=="She worked carefully.","guarded adjunct contraction");
  return failures?1:0;
}
