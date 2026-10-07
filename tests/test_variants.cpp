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
  return failures?1:0;
}
