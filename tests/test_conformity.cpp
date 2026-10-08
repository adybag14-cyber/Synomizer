// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "synomizer/engine.hpp"
#include <iostream>
#include <stdexcept>
using namespace synomizer;
int main() {
  int failures=0;
  const auto expect=[&](bool pass,const char* message){if(!pass){++failures;std::cerr<<message<<'\n';}};
  Options o;o.profile="combined";o.require_conformity=true;
  for(const std::string text:{"","abc","Use the lever.","The report may be wrong."}) {
    const auto result=rewrite(text,o);
    expect(result.standards.has_value(),"report required");
    if(!result.standards)continue;
    const auto& c=result.standards->conformity;
    expect(!c.release_allowed && !c.conformity_verified && c.strict_requested,"strict release blocked");
    expect(c.decision=="blocked" && c.requirements.size()==57,"explicit coverage and decision");
    for(const auto& rule:c.requirements)expect(rule.result!="pass" && rule.result!="verified","no fake rule approval");
    if(text.empty())expect(c.source_sha256=="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","empty hash");
    if(text=="abc")expect(c.source_sha256=="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad","abc hash");
  }
  auto result=rewrite("The selection includes copper, zinc or nickel.",o);
  expect(result.text=="The selection includes:\n- copper,\n- zinc\n- or nickel.","OR enumeration retained");
  o.structured_lists=false;
  expect(rewrite("The selection includes copper, zinc or nickel.",o).text=="The selection includes copper, zinc or nickel.","list switch respected");
  o.check_only=true;
  expect(rewrite("Read \"DO NOT OPEN\" before the test.",o).standards->after.words==5,"quoted count grouping");
  expect(rewrite("The cover is closed (the light is off).",o).standards->after.sentences==2,"parenthetical count unit");
  o.profile="plain";
  expect(rewrite("Use the lever.",o).standards->conformity.requirements.size()==4,"four ISO principles");
  o.check_only=false;o.profile="variation";
  try{(void)rewrite("Use the lever.",o);expect(false,"strict variation rejected");}catch(const std::invalid_argument&){}
  return failures?1:0;
}
