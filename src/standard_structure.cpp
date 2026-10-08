// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
// Limited deterministic structures. Drafting rules, not semantic proofs.
#include "internal.hpp"
#include <algorithm>
#include <initializer_list>

namespace synomizer {
namespace {
using Tokens=std::vector<Token>;
bool one_of(std::string_view s,std::initializer_list<std::string_view> xs) {return std::find(xs.begin(),xs.end(),s)!=xs.end();}
bool blank(const Token& t) {return !t.word && !t.text.empty() && t.text.find_first_not_of(" \t")==std::string::npos;}
bool letters(std::string_view s) {return !s.empty() && std::ranges::all_of(s,[](unsigned char c){return is_letter(c)||c=='-';});}
Tokens slice(const Tokens& t,std::size_t a,std::size_t b) {
  while(a<b && blank(t[a])) ++a;
  while(b>a && blank(t[b-1])) --b;
  return Tokens(t.begin()+static_cast<std::ptrdiff_t>(a),t.begin()+static_cast<std::ptrdiff_t>(b));
}
std::vector<std::string> words(const Tokens& t) {std::vector<std::string> r;for(const auto& x:t)if(x.word)r.push_back(lower_copy(x.text));return r;}
Tokens scanned(std::string_view text) {
  Tokens out;
  for(const auto& p:split_pieces(text)) {
    if(p.sentence)out.insert(out.end(),p.tokens.begin(),p.tokens.end());
    else out.push_back({p.text,false,false,false});
  }
  return out;
}
bool finite(std::string_view w) {
  return one_of(w,{"offer","offers","offered","provide","provides","provided","require","requires","required","depend","depends","depended","support","supports","supported","retain","retains","retained","contain","contains","contained","include","includes","included","combine","combines","combined","demonstrate","demonstrates","demonstrated","broaden","broadens","broadened"});
}
bool scope_word(std::string_view w) {
  return one_of(w,{"not","no","never","only","either","neither","nor","if","unless","when","whenever","before","after","because","until","that","whether","who","which","whose","why","how","can","could","may","might","must","shall","should","will","would","say","says","said","think","thinks","thought","believe","believes","believed","claim","claims","claimed","suggest","suggests","suggested","expect","expects","expected","assume","assumes","assumed","suppose","supposes","supposed","seem","seems","seemed","certain","sure","evidence"});
}
bool supported_head(const std::string& w) {
  return lexicon().has(w,Pos::Noun) || one_of(w,{"method","methods","catalyst","catalysts","amination","reaction","reactions","system","systems","process","processes","procedure","procedures","sustainability","chemistry","assessment","assessments","study","studies","comparison","comparisons","analysis","analyses","report","reports","test","tests","results","technique","techniques","device","devices","model","models","it","they","we","he","she"});
}
std::optional<std::size_t> direct_predicate(const Tokens& t,bool allow_subordinate=false) {
  std::vector<std::size_t> p;for(std::size_t i=0;i<t.size();++i)if(t[i].word)p.push_back(i);
  for(std::size_t slot=1;slot<p.size() && slot<=14;++slot) {
    if(!finite(lower_copy(t[p[slot]].text))) continue;
    auto last=slot-1;
    if(one_of(lower_copy(t[p[last]].text),{"already","also","often","usually","currently"}) && last>0) --last;
    if(!supported_head(lower_copy(t[p[last]].text))) return std::nullopt;
    for(std::size_t j=0;j<slot;++j) {
      const auto w=lower_copy(t[p[j]].text);
      if(is_aux(w)||is_preposition(w)||scope_word(w)||finite(w)) return std::nullopt;
    }
    bool subordinate=false;
    for(std::size_t j=slot+1;j<p.size();++j) {
      const auto w=lower_copy(t[p[j]].text);
      if(allow_subordinate && w=="although") {subordinate=true;continue;}
      if(scope_word(w)||(!subordinate && ((w!="to" && is_aux(w))||finite(w)))) return std::nullopt;
    }
    return p[slot];
  }
  return std::nullopt;
}
std::optional<std::string> nominal_list(const Tokens& t) {
  // Keep the reporting/conditional prefix and the original conjunction.
  for(std::size_t i=0;i<t.size();++i) {
    const auto w=lower_copy(t[i].text);std::size_t end=i+1;
    bool match=one_of(w,{"includes","include","combines","combine","contains","contain"});
    if((w=="control" || w=="consists" || w=="consist") && i+2<t.size() && blank(t[i+1]) && lower_copy(t[i+2].text)=="of") {match=true;end=i+3;}
    if(!match || end>=t.size() || !blank(t[end])) continue;
    const auto body=slice(t,end,t.size()-1);
    std::vector<Tokens> parts;std::size_t begin=0;
    for(std::size_t j=0;j<body.size();++j)if(body[j].text==","){parts.push_back(slice(body,begin,j));begin=j+1;}
    parts.push_back(slice(body,begin,body.size()));
    if(parts.size()<2 || parts.size()>10) continue;
    std::string connector;auto tail=parts.back();
    for(std::size_t j=0;j<tail.size();++j) {
      const auto v=lower_copy(tail[j].text);
      if(v!="and" && v!="or") continue;
      if(!connector.empty()) {connector="invalid";break;}
      connector=v;
      if(j==0) parts.back()=slice(tail,1,tail.size());
      else {parts.back()=slice(tail,0,j);parts.push_back(slice(tail,j+1,tail.size()));}
    }
    if(connector.empty()||connector=="invalid"||parts.size()<3||parts.size()>10) continue;
    bool valid=true;
    if(words(parts.back()).size()>1 && std::ranges::any_of(parts,[](const auto& p){return words(p).size()==1;})) continue; // A shared final head (red, blue and green lights) is ambiguous.
    for(const auto& part:parts) {
      const auto ws=words(part);if(ws.empty()||ws.size()>7){valid=false;break;}
      for(const auto& x:part) {
        const auto v=lower_copy(x.text);
        if((!x.word&&!blank(x)) || (x.word && (!letters(x.text)||is_aux(v)||finite(v)||is_subordinator_word(v)||is_preposition(v)||one_of(v,{"and","or","not","no","without","except","excluding","including"})))) {valid=false;break;}
      }
    }
    if(!valid)continue;
    auto out=concat_tokens(slice(t,0,end))+" the following:\n";
    for(std::size_t j=0;j<parts.size();++j) {
      out+="- ";if(j+1==parts.size()) out+=connector+" ";
      out+=concat_tokens(parts[j]);out+=(j+1==parts.size()?".":",\n");
    }
    return out+"\n\n";
  }
  return std::nullopt;
}
} // namespace
std::optional<ArrangeOutcome> standard_structure(const std::vector<Token>& tokens,bool lists) {
  if(tokens.empty() || tokens.size()>600 || tokens.back().text!=".")return std::nullopt;
  for(const auto& t:tokens) {
    if(t.text.find_first_of("\r\n")!=std::string::npos)return std::nullopt;
    if(t.word) {if(!letters(t.text))return std::nullopt;}
    else if(!blank(t) && !one_of(t.text,{".",",",":"}))return std::nullopt;
  }
  const auto make=[&](std::string text,std::string detail)->std::optional<ArrangeOutcome>{return ArrangeOutcome{scanned(text),{ChangeKind::Arrangement,concat_tokens(tokens),std::move(text),std::move(detail)}};};
  if(lists) if(auto text=nominal_list(tokens)) return make(*text,"Clarity: preserved a nominal enumeration as a vertical list");
  for(const auto& t:tokens)if(scope_word(lower_copy(t.text)))return std::nullopt;
  std::size_t boundary=tokens.size(),right=tokens.size();std::string link;
  for(std::size_t i=1;i+1<tokens.size();++i) {
    if(tokens[i].text==":") {
      if(boundary!=tokens.size())return std::nullopt;
      boundary=i;right=i+1;
    } else if(tokens[i].text=="," && i+3<tokens.size() && blank(tokens[i+1]) && lower_copy(tokens[i+2].text)=="but" && blank(tokens[i+3])) {
      if(boundary!=tokens.size())return std::nullopt;
      boundary=i;right=i+4;link="But ";
    }
  }
  if(boundary==tokens.size())return std::nullopt;
  const auto left=slice(tokens,0,boundary),tail=slice(tokens,right,tokens.size()-1);
  const auto predicate=direct_predicate(left);
  if(!predicate || tail.empty())return std::nullopt;
  auto after=concat_tokens(tail);
  if(!direct_predicate(tail,true)) {
    // Repeat an explicit subject only for a positive non-modal shared predicate.
    if(link.empty() || !finite(lower_copy(tail.front().text)))return std::nullopt;
    auto subject=concat_tokens(slice(left,0,*predicate));const auto sw=words(slice(left,0,*predicate));
    if(sw.empty()||one_of(sw.front(),{"all","each","every","any","some","a","an"}))return std::nullopt;
    if(one_of(lower_copy(subject),{"the","this","these","those","its","their","our"})) return std::nullopt;
    if(one_of(sw.front(),{"aqueous","recent","published","the","this","these","those","its","their","our"})) subject[0]=ascii_lower(static_cast<unsigned char>(subject[0]));
    after=subject+" "+after;
    if(!direct_predicate(scanned(after)))return std::nullopt;
  }
  if(!after.empty() && link.empty()) after[0]=ascii_upper(static_cast<unsigned char>(after[0]));
  return make(concat_tokens(left)+". "+link+after+".","Clarity: separated supported descriptive clauses without dropping their connection");
}
} // namespace synomizer
