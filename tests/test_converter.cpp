// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "synomizer/engine.hpp"
#include <iostream>
#include <set>
#include <string>
using namespace synomizer;
int main() {
  int failures=0;
  const auto expect=[&](bool ok,const char* why){if(!ok){++failures;std::cerr<<why<<'\n';}};
  Options o;o.profile="combined";o.require_conformity=true;
  const std::string source="The process requires control of temperature, pressure or flow.";
  auto r=rewrite(source,o);
  expect(r.text=="The process requires control of the following:\n- temperature,\n- pressure,\n- or flow.\n\n","nominal list preserves disjunction");
  expect(r.standards.has_value(),"standards report exists");
  if(r.standards) {
    const auto& c=r.standards->conformity;
    expect(!c.release_allowed&&!c.conformity_verified&&c.decision=="blocked","no false release");
    expect(c.strict_requested&&c.invariant_check=="passed","requested gate and selected marker check");
    expect(c.requirements.size()==57,"53 STE references plus 4 ISO principles");
    expect(r.standards->screens.size()==2,"combined exposes two review views");
    if(r.standards->screens.size()==2) {
      const auto& ste=r.standards->screens[0];const auto& plain=r.standards->screens[1];
      expect(ste.profile=="ste"&&plain.profile=="plain","named target views");
      expect(ste.draft_sha256==plain.draft_sha256&&ste.draft_sha256==c.draft_sha256,"both targets assess one exact draft");
    }
    std::set<std::string> ids;
    for(const auto& row:c.requirements) {
      ids.insert(row.standard+"/"+row.rule);
      expect(row.result=="not-verified"||row.result=="attention","no implicit rule pass");
      expect(!(row.standard=="ASD-STE100 Issue 9"&&row.rule=="2.3"),"obsolete rule omitted");
    }
    expect(ids.size()==57,"distinct requirements");
    expect(c.source_sha256!=c.draft_sha256,"different draft digest");
  }
  o.structured_lists=false;
  expect(rewrite(source,o).text==source,"list opt-out");
  o.structured_lists=true;o.check_only=true;
  expect(rewrite(source,o).text==source,"check-only unchanged");
  o.profile="plain";
  r=rewrite("abc",o);
  expect(r.standards && r.standards->conformity.draft_sha256=="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad","SHA-256 independent known vector");
  r=rewrite("",o);
  expect(r.standards && r.standards->conformity.source_sha256=="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","empty digest");
  expect(r.standards && !r.standards->conformity.release_allowed,"empty text not a pass");
  o.check_only=false;
  for(const std::string text:{"All methods provide alternatives, but retain limitations.","The system contains red, blue and green lights.","The analyst has said the valve is open, and the light is on."})
    expect(rewrite(text,o).text==text,"ambiguous structures retained");
  r=rewrite("The valve was opened by the technician. Do not exceed 5 bar.",o);
  expect(r.text=="The technician opened the valve. Do not exceed 5 bar.","actor and numeric obligation retained");
  o.check_only=true;
  std::string malformed;for(int i=0;i<16000;++i)malformed+="(word ";malformed+='.';
  r=rewrite(malformed,o);
  expect(r.text==malformed&&r.standards&&r.standards->after.longest_sentence==16000,"bounded unmatched-parenthesis counting");
  o.profile="combined";o.text_type="procedure";o.check_only=true;
  std::string boundary;for(int i=0;i<21;++i){if(i)boundary+=' ';boundary+="word";}boundary+='.';
  r=rewrite(boundary,o);
  expect(r.standards&&r.standards->screens.size()==2,"two target screens for procedure");
  if(r.standards&&r.standards->screens.size()==2) {
    expect(r.standards->screens[0].sentence_target==20&&r.standards->screens[1].sentence_target==25,"STE and advisory targets distinct");
    expect(r.standards->screens[0].after.long_sentences==1&&r.standards->screens[1].after.long_sentences==0,"distinct length findings for the same text");
  }
  return failures?1:0;
}
