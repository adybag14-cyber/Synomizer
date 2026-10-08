// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "synomizer/engine.hpp"
#include <iostream>
#include <stdexcept>
using namespace synomizer;
int main() {
  int failures=0;
  const auto expect=[&](bool ok,const char* message){if(!ok){++failures;std::cerr<<message<<'\n';}};
  Options o; o.profile="combined";
  auto r=rewrite("The valve was opened by the technician. Utilize the lever.",o);
  expect(r.text=="The technician opened the valve. Use the lever.","explicit agent/clarity rewrite");
  expect(r.standards && r.standards->status=="review-required","no conformity badge");
  expect(r.standards && !r.standards->semantic_equivalence_verified,"meaning not certified");
  o.check_only=true;
  const std::string source="The valve may be opened.\nDo not exceed 5 bar.";
  r=rewrite(source,o);expect(r.text==source && r.changes.empty(),"check only preserves content");
  o.check_only=false;
  expect(rewrite("The valve was opened.",o).text=="The valve was opened.","unknown agent unchanged");
  expect(rewrite("The valve was not opened by the technician.",o).text=="The valve was not opened by the technician.","negation unchanged");
  expect(rewrite("The road to the station; the road to the harbor.",o).text=="The road to the station; the road to the harbor.","nonfinite fragments not split");
  expect(rewrite_variants("The happy child bought a car.",o,3).variants.size()==1,"one consistent result");
  o.vocabulary=parse_vocabulary("utilize\tnoun\tA local component label\ttechnical-noun\n");
  expect(rewrite("Utilize was printed on the label.",o).text=="Utilize was printed on the label.","technical term protection");
  try { (void)parse_vocabulary("x\tnoun\ty\ttechnical-verb\n"); expect(false,"invalid vocabulary rejected"); } catch(const std::invalid_argument&) {}
  o.vocabulary.clear();
  std::string long_text;
  for(int i=0;i<600;++i) long_text+="The valve was opened. ";
  r=rewrite(long_text,o);
  expect(r.text==long_text,"complete long output");
  expect(r.standards && r.standards->findings.size()<=251,"bounded findings");
  return failures?1:0;
}
