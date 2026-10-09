// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "internal.hpp"
#include <algorithm>
#include <set>
#include <stdexcept>

namespace synomizer {
namespace {
bool letter(char c){return (c>='a'&&c<='z')||(c>='A'&&c<='Z');}
bool digit(char c){return c>='0'&&c<='9';}
bool alnum(char c){return letter(c)||digit(c);}
bool whitespace(char c){return c==' '||c=='\t'||c=='\n'||c=='\r';}
bool contains(std::string_view word,std::string_view list){return (" "+std::string(list)+" ").find(" "+std::string(word)+" ")!=std::string::npos;}
std::vector<std::string> words_of(std::string_view text){
 std::vector<std::string> out;
 for(std::size_t i=0;i<text.size();){
  if(!letter(text[i])){++i;continue;}auto j=i+1;
  while(j<text.size()&&(alnum(text[j])||(text[j]=='-'&&j+1<text.size()&&alnum(text[j+1]))))++j;
  out.emplace_back(text.substr(i,j-i));i=j;
 }return out;
}
ContextField field(std::string value,std::string evidence="",std::string origin="inferred-rules"){return {std::move(value),std::move(origin),std::move(evidence)};}
bool safe(std::string_view s,std::size_t limit){return !s.empty()&&s.size()<=limit&&std::ranges::none_of(s,[](unsigned char c){return c<32&&c!='\t'&&c!='\n'&&c!='\r';});}
} // namespace
std::size_t term_occurrences(std::string_view text,std::string_view term){
 const auto hay=lower_copy(text),needle=lower_copy(term);std::size_t at=0,n=0;if(needle.empty())return 0;
 while((at=hay.find(needle,at))!=std::string::npos){const auto end=at+needle.size();if((at==0||!alnum(hay[at-1]))&&(end==hay.size()||!alnum(hay[end])))++n;at=end;}return n;
}
AutomaticContext infer_context(std::string_view text){
 AutomaticContext out;out.source_sha256=sha256_text(text);
 const auto words=words_of(text);std::size_t research=0,directions=0;std::string research_cue,direction_cue;
 for(const auto& word:words)if(contains(lower_copy(word),"review study studies research evidence results analysis catalyst catalysts solvent solvents experiment experiments clinical findings mechanistic arylation amination")){++research;if(research_cue.empty())research_cue=word;}
 std::size_t begin=0;
 for(std::size_t end=0;end<=text.size();++end)if(end==text.size()||text[end]=='.'||text[end]=='!'||text[end]=='?'||text[end]=='\n'){
  auto at=begin;while(at<end&&whitespace(text[at]))++at;
  auto n=at;while(n<end&&digit(text[n]))++n;
  if(n>at){if(n<end&&(text[n]=='.'||text[n]==')'))++n;if(n<end&&whitespace(text[n]))at=n;}
  else if(at+1<end&&(text[at]=='-'||text[at]=='*'||text[at]=='+')&&whitespace(text[at+1]))at+=2;
  while(at<end&&whitespace(text[at]))++at;
  n=at;
  while(n<end&&letter(text[n]))++n;
  const std::string first(text.substr(at,n-at));
  if(contains(lower_copy(first),"open close remove install inspect check connect disconnect press turn tighten loosen measure record verify clean replace attach insert select click enter mix add heat cool rinse")&&!first.empty()){++directions;if(direction_cue.empty())direction_cue=first;}
  begin=end+1;
 }
 out.genre="general";std::string type="description",audience="General readers (provisional)",purpose="Understand the information in this text.",cue;
 if(research>=3){out.genre="research";audience="Readers with relevant technical background (provisional)";purpose="Understand the research question, evidence, limitations and proposed work.";cue=research_cue;}
 else if(directions>=2){out.genre="instructions";type="procedure";audience="People carrying out the described task (provisional)";purpose="Carry out the steps and observe the stated conditions and warnings.";cue=direction_cue;}
 else {auto at=std::size_t{0};while(at<text.size()&&whitespace(text[at]))++at;auto end=at;while(end<text.size()&&letter(text[end]))++end;const auto first=lower_copy(text.substr(at,end-at));if(!first.empty()&&contains(first,"dear hello hi")){out.genre="correspondence";audience="The intended recipient (provisional)";purpose="Understand the message and any requested response.";cue=words.empty()?"":words.front();}}
 out.audience=field(audience,cue);out.purpose=field(purpose,cue);out.text_type=field(type,cue);
 std::set<std::string> seen;
 const auto add=[&](const std::string& term){if(out.terms.size()<48&&term.size()<=120&&seen.insert(lower_copy(term)).second)out.terms.push_back(term);};
 for(const auto& word:words){
  if(word.size()<2)continue;
  const bool capital=std::ranges::all_of(word,[](char c){return c>='A'&&c<='Z';});
  if(contains(lower_copy(word),"arylation amination picolinamide picolinamides carbamate carbamates heterocycle heterocycles nucleophile nucleophiles micellar eutectic selectivity phosphorylation chromatography spectroscopy pharmacokinetics")||word.find('-')!=std::string::npos||std::ranges::any_of(word,digit)||(capital&&!contains(word,"THE AND OR NOT DO NOTE WARNING CAUTION IMPORTANT STEP USE IF WHEN THEN")))add(word);
 }
 const auto lower=lower_copy(text);
 for(const std::string phrase:{"isobutyl acetate","deep eutectic","copper species","oxidation state","statistical significance","control group","confidence interval"}){
  const auto at=lower.find(phrase);if(at!=std::string::npos&&term_occurrences(text,phrase))add(std::string(text.substr(at,phrase.size())));
 }
 out.warnings={"Reader, purpose and text-type settings are inferred, not confirmed.","Source terminology is protected as written; no approved STE dictionary or reader evaluation is inferred."};
 if(words.empty())out.warnings.push_back("No assessable English context was found; generic settings are provisional.");
 if(research>=3&&directions>=2)out.warnings.push_back("This text appears to mix research discussion and instructions; descriptive mode was retained.");
 return out;
}
void apply_auto_context(AutomaticContext& context,Options& options,std::string_view text){
 if(options.auto_proposal){
  const auto& p=*options.auto_proposal;
  if(p.terms.size()>48||p.review_hints.size()>8)throw std::invalid_argument("Too many model context terms or hints");
  const auto apply=[&](ContextField& target,const std::optional<ContextField>& proposed,std::size_t limit){if(!proposed)return;if(!safe(proposed->value,limit)||!safe(proposed->evidence,240)||text.find(proposed->evidence)==std::string_view::npos)throw std::invalid_argument("Ungrounded model context evidence");target=field(proposed->value,proposed->evidence,"inferred-bonsai2");};
  apply(context.audience,p.audience,240);apply(context.purpose,p.purpose,320);apply(context.text_type,p.text_type,240);
  if(context.text_type.value!="description"&&context.text_type.value!="procedure")throw std::invalid_argument("Invalid proposed text type");
  for(const auto& term:p.terms){if(!safe(term,120)||!term_occurrences(text,term))throw std::invalid_argument("Proposed term is absent from source");if(context.terms.size()<48&&std::find(context.terms.begin(),context.terms.end(),term)==context.terms.end())context.terms.push_back(term);}
  for(const auto& hint:p.review_hints){if((hint.standard!="ste"&&hint.standard!="plain")||!safe(hint.note,400)||!safe(hint.evidence,240)||text.find(hint.evidence)==std::string_view::npos)throw std::invalid_argument("Ungrounded model review hint");context.review_hints.push_back(hint);}
  context.method="bonsai2+rules-v1";context.sampled=p.sampled;
  context.warnings.push_back("Bonsai 2 suggestions are model inferences, not verified facts, approved terminology or conformity decisions.");
 }
 if(!options.audience.empty())context.audience=field(options.audience,"","user");else options.audience=context.audience.value;
 if(!options.purpose.empty())context.purpose=field(options.purpose,"","user");else options.purpose=context.purpose.value;
 if(options.text_type!="auto")context.text_type=field(options.text_type,"","user");else options.text_type=context.text_type.value;
}
} // namespace synomizer
