// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

#include "synomizer/engine.hpp"

#include <cstdlib>
#include <iostream>
#include <string>
#include <string_view>
#include <vector>

namespace {

int g_fails = 0;
int g_checks = 0;

void expect(bool ok, std::string_view name, std::string_view detail = {}) {
  ++g_checks;
  if (ok) {
    return;
  }
  ++g_fails;
  std::cerr << "FAIL " << name;
  if (!detail.empty()) {
    std::cerr << ": " << detail;
  }
  std::cerr << "\n";
}

void expect_eq(std::string_view actual, std::string_view wanted, std::string_view name) {
  ++g_checks;
  if (actual == wanted) {
    return;
  }
  ++g_fails;
  std::cerr << "FAIL " << name << "\n  actual: " << actual << "\n  wanted: " << wanted << "\n";
}

bool contains(std::string_view text, std::string_view piece) {
  return text.find(piece) != std::string_view::npos;
}

std::size_t words(std::string_view text) {
  std::size_t count = 0;
  bool in = false;
  for (unsigned char c : text) {
    const bool letter = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
    if (letter && !in) {
      ++count;
    }
    in = letter;
  }
  return count;
}

synomizer::Result run(std::string_view text, synomizer::Options options = {}) {
  return synomizer::rewrite(text, options);
}

}  // namespace

int main() {
  synomizer::Options off;
  off.synonyms = false;
  off.arrange = false;
  const std::string_view samples[] = {
      "",
      "Hello, world!",
      "The bank was on the right.",
      "The value was 3.14 exactly.",
      "Dr. Smith arrived late.",
      "Because Mr. Smith was late, the bus arrived.",
      "She said \"happy\" once.",
      "Line one.\n\nLine two.",
  };
  for (std::string_view sample : samples) {
    expect_eq(run(sample, off).text, sample, "roundtrip with rewrites off");
  }

  expect_eq(run("Hello, world!").text, "Hello, world!", "unchanged greeting");
  expect_eq(run("The bank was on the right.").text, "The bank was on the right.", "ambiguous words stay");
  expect_eq(run("The value was 3.14 exactly.").text, "The value was 3.14 exactly.", "decimal stays intact");
  expect_eq(run("Dr. Smith arrived late.").text, "Dr. Smith arrived late.", "abbreviation stays intact");

  {
    synomizer::Options arrange;
    arrange.synonyms = false;
    expect_eq(run("Because the road was icy, the bus arrived late.", arrange).text,
              "The bus arrived late because the road was icy.", "fronted because moves to the end");
    expect_eq(run("The bus arrived late because the road was icy.", arrange).text,
              "Because the road was icy, the bus arrived late.", "trailing because moves to the front");
    expect_eq(run("I stayed because the road was icy.", arrange).text, "Because the road was icy, I stayed.",
              "pronoun I keeps its capital");
    expect_eq(run("Alice left because the bus arrived.", arrange).text, "Because the bus arrived, Alice left.",
              "a proper noun keeps its capital");
    expect_eq(run("Even though the road was icy, the bus arrived late.", arrange).text,
              "The bus arrived late even though the road was icy.", "even though moves to the end");
    expect_eq(run("Because Mr. Smith was late, the bus arrived.", arrange).text,
              "The bus arrived because Mr. Smith was late.", "abbreviation does not split the clause");
    expect_eq(run("Because the value was 3.14, the bus arrived.", arrange).text,
              "The bus arrived because the value was 3.14.", "decimal does not split the clause");
    expect_eq(run("The bus arrived late, though.", arrange).text, "The bus arrived late, though.",
              "final though is not a clause");
    expect_eq(run("We left after the meeting.", arrange).text, "We left after the meeting.",
              "after a noun phrase is not a clause");
    expect_eq(run("Although the journey was long, the group remained cheerful and completed the work.", arrange).text,
              "Although the journey was long, the group remained cheerful and completed the work.",
              "coordinated main clause stays put");
    expect_eq(run("Quickly, she left the room.", arrange).text, "She left the room quickly.",
              "fronted manner adverb moves to the end");
    expect_eq(run("She left the room quickly.", arrange).text, "Quickly, she left the room.",
              "final manner adverb moves to the front");
    expect_eq(run("It was a bright and cheerful room.", arrange).text, "It was a cheerful and bright room.",
              "coordinated adjectives swap");
  }

  expect_eq(run("They purchased a car.").text, "They bought an automobile.", "purchase inflects and a/an follows");
  expect_eq(run("They have selected a car.").text, "They have chosen an automobile.", "participle choose");
  expect_eq(run("They selected a car.").text, "They chose an automobile.", "past choose");
  expect_eq(run("She started the car.").text, "She started the automobile.", "do not begin a car");
  expect_eq(run("They bought her a car.").text, "They bought her an automobile.", "ditransitive buy stays");
  expect_eq(run("They find the keys.").text, "They locate the keys.", "find with an object");
  expect_eq(run("They find out things.").text, "They find out things.", "phrasal find out stays");
  expect_eq(run("A person arrived.").text, "An individual arrived.", "person takes an");
  expect_eq(run("A bigger car waited.").text, "A larger automobile waited.", "comparative big becomes larger");
  expect_eq(run("She is happier today.").text, "She is happier today.", "happier has no grammatical synonym");
  expect_eq(run("They ran fast.").text, "They ran fast.", "fast after a verb stays adverbial");
  {
    const std::string text = run("They remained calm.").text;
    expect(contains(text, "stayed") && (contains(text, "peaceful") || contains(text, "tranquil")) &&
               !contains(text, "remained") && !contains(text, "calm"),
           "predicative calm still changes", text);
  }
  expect_eq(run("It was an honest mistake.").text, "It was an honest mistake.", "honest mistake is a protected collocation");
  expect_eq(run("The money was hidden.").text, "The cash was concealed.", "mass noun and participle");
  expect_eq(run("The children were ready.").text, "The youngsters were prepared.", "irregular plural");
  expect_eq(run("It was a short visit.").text, "It was a brief visit.", "short of time");
  expect_eq(run("It was a short man.").text, "It was a short man.", "short of a person stays");
  expect_eq(run("Many children arrived.").text, "Numerous youngsters arrived.", "quantifier many");
  expect_eq(run("Many of the children arrived.").text, "Many of the youngsters arrived.", "many of stays");
  expect_eq(run("She tried to change the plan.").text, "She attempted to change the plan.",
            "careful verb waits for intensity 2");
  {
    synomizer::Options strong;
    strong.intensity = 2;
    expect_eq(run("She tried to change the plan.", strong).text, "She attempted to alter the plan.",
              "intensity 2 alters change");
  }
  {
    synomizer::Options light;
    light.intensity = 0;
    const std::string text = run("The happy child bought a car.", light).text;
    expect(contains(text, "child") && contains(text, "bought") && contains(text, "car") && !contains(text, "happy"),
           "intensity 0 keeps nouns and verbs", text);
  }

  {
    const std::string text = run("The meeting started early.").text;
    expect(contains(text, "assembly") && contains(text, "early") &&
               (contains(text, "began") || contains(text, "commenced")) && !contains(text, "meeting") &&
               !contains(text, "started"),
           "intransitive start can move", text);
  }
  {
    const std::string text = run("The happy child said \"happy\".").text;
    expect(contains(text, "\"happy\"") && contains(text, "youngster") && !contains(text, "child"),
           "quotes stay and the child changes", text);
    expect(text.find("happy") == text.rfind("happy"), "quoted happy is the only happy", text);
  }
  {
    const std::string text = run("She used to help.").text;
    expect(contains(text, "used to") && !contains(text, "help"), "used to is protected", text);
  }
  {
    const std::string text = run("Alice was happy in Paris.").text;
    expect(contains(text, "Alice") && contains(text, "Paris") && !contains(text, "happy"), "proper nouns stay", text);
  }
  {
    const std::string text = run("NASA was happy.").text;
    expect(contains(text, "NASA") && !contains(text, "happy"), "acronym stays", text);
  }

  const std::string paragraph =
      "The careful teacher helped the happy children. Because the weather was cold, the class started the project "
      "late. She quietly explained the main idea, and the students were glad to assist. They purchased a small car "
      "for the school trip and quickly found the correct route. The calm physician said the tired boy was healthy. "
      "Although the journey was long, the group remained cheerful. The writer described the final result in an honest "
      "report. The crowd was silent when the meeting ended. The local students found a useful answer and remained "
      "calm. It was a small victory.";
  expect(words(paragraph) >= 90 && words(paragraph) <= 110, "sample is about 100 words", std::to_string(words(paragraph)));
  const synomizer::Result once = run(paragraph);
  const synomizer::Result twice = run(paragraph);
  expect_eq(once.text, twice.text, "same seed is deterministic");
  expect(once.text != paragraph, "sample wording changes", once.text);
  expect(words(once.text) >= 90 && words(once.text) <= 130, "sample length stays in range", once.text);
  int arrangements = 0;
  int synonyms = 0;
  for (const synomizer::Change& change : once.changes) {
    if (change.kind == synomizer::ChangeKind::Arrangement) {
      ++arrangements;
    }
    if (change.kind == synomizer::ChangeKind::Synonym) {
      ++synonyms;
    }
  }
  expect(arrangements >= 1, "sample rearranges at least one sentence", once.text);
  expect(synonyms >= 8, "sample substitutes several words", std::to_string(synonyms));
  synomizer::Options other;
  other.seed = 2;
  expect(run(paragraph, other).text != once.text, "a different seed can choose different synonyms", once.text);

  bool articles_ok = true;
  std::string article_problem;
  for (int seed = 1; seed <= 12; ++seed) {
    synomizer::Options options;
    options.seed = static_cast<std::uint64_t>(seed);
    const std::string text = run("She saw a big owl beside an honest guide and a union.", options).text;
    std::string previous;
    std::string current;
    for (std::size_t i = 0; i <= text.size(); ++i) {
      const bool letter = i < text.size() && ((text[i] >= 'A' && text[i] <= 'Z') || (text[i] >= 'a' && text[i] <= 'z'));
      if (letter) {
        current.push_back(text[i]);
        continue;
      }
      if (!current.empty()) {
        std::string low = current;
        for (char& c : low) {
          if (c >= 'A' && c <= 'Z') {
            c = static_cast<char>(c - 'A' + 'a');
          }
        }
        if (previous == "a" || previous == "an") {
          const bool vowel = !low.empty() && (low[0] == 'a' || low[0] == 'e' || low[0] == 'i' || low[0] == 'o' ||
                                               low[0] == 'u' || low.starts_with("hour") || low.starts_with("honest"));
          const bool y_sound = low.starts_with("uni") || low.starts_with("use") || low.starts_with("one");
          const bool want_an = vowel && !y_sound;
          if ((previous == "an") != want_an) {
            articles_ok = false;
            article_problem = text;
          }
        }
        previous = low;
        current.clear();
      }
    }
  }
  expect(articles_ok, "a/an matches the following sound", article_problem);


  // Safety regressions shared with the browser/native differential corpus.
  { synomizer::Options o; expect_eq(run("She said \"The bus arrived because the road was icy.\"",o).text, "She said \"The bus arrived because the road was icy.\"", "unchanged 0"); }
  { synomizer::Options o; expect_eq(run("She said “happy. happy.”",o).text, "She said “happy. happy.”", "unchanged 1"); }
  { synomizer::Options o; expect_eq(run("She said 'happy. happy.'",o).text, "She said 'happy. happy.'", "unchanged 2"); }
  { synomizer::Options o; expect_eq(run("She said «happy. happy.»",o).text, "She said «happy. happy.»", "unchanged 3"); }
  { synomizer::Options o; expect_eq(run("She said “He said ‘happy.’”.",o).text, "She said “He said ‘happy.’”.", "unchanged 4"); }
  { synomizer::Options o; expect_eq(run("She said \"happy. happy.",o).text, "She said \"happy. happy.", "unchanged 5"); }
  { synomizer::Options o; expect_eq(run("https://happy.example/car?choice=happy&result=big",o).text, "https://happy.example/car?choice=happy&result=big", "unchanged 6"); }
  { synomizer::Options o; expect_eq(run("happy@example.com",o).text, "happy@example.com", "unchanged 7"); }
  { synomizer::Options o; expect_eq(run("`The happy child bought a car.`",o).text, "`The happy child bought a car.`", "unchanged 8"); }
  { synomizer::Options o; expect_eq(run("```cpp\nconst auto happy = \"car\";\n```",o).text, "```cpp\nconst auto happy = \"car\";\n```", "unchanged 9"); }
  { synomizer::Options o; expect_eq(run("`happy child",o).text, "`happy child", "unchanged 10"); }
  { synomizer::Options o; expect_eq(run("I lived alone.",o).text, "I lived alone.", "unchanged 11"); }
  { synomizer::Options o; expect_eq(run("It was an honest mistake.",o).text, "It was an honest mistake.", "unchanged 12"); }
  { synomizer::Options o; expect_eq(run("The value was 3.14 exactly.",o).text, "The value was 3.14 exactly.", "unchanged 14"); }
  { synomizer::Options o; o.synonyms=false; expect_eq(run("She did not leave because the bus arrived.",o).text, "She did not leave because the bus arrived.", "scope 0"); }
  { synomizer::Options o; o.synonyms=false; expect_eq(run("She didn't leave because the bus arrived.",o).text, "She didn't leave because the bus arrived.", "scope 1"); }
  { synomizer::Options o; o.synonyms=false; expect_eq(run("She left very quickly.",o).text, "She left very quickly.", "scope 2"); }
  { synomizer::Options o; o.synonyms=false; expect_eq(run("She may leave because the bus arrived.",o).text, "She may leave because the bus arrived.", "scope 3"); }
  { synomizer::Options o; o.synonyms=false; expect_eq(run("I know she left because the bus arrived.",o).text, "I know she left because the bus arrived.", "scope 4"); }
  { synomizer::Options o; o.synonyms=false; expect_eq(run("She told him to leave quickly.",o).text, "She told him to leave quickly.", "scope 5"); }
  { synomizer::Options o; o.synonyms=false; expect_eq(run("Sadly, she left the room.",o).text, "Sadly, she left the room.", "scope 6"); }
  { synomizer::Options o; o.synonyms=false; expect_eq(run("They arrived when she left because it was late.",o).text, "They arrived when she left because it was late.", "scope 7"); }
  { synomizer::Options o; o.synonyms=false; expect_eq(run("Did she leave because the bus arrived?",o).text, "Did she leave because the bus arrived?", "scope 8"); }
  { synomizer::Options o; o.synonyms=false; expect_eq(run("She left (quietly) because the bus arrived.",o).text, "She left (quietly) because the bus arrived.", "scope 9"); }
  { synomizer::Options o; o.synonyms=false; expect_eq(run("Because she was late,\nshe left quickly.",o).text, "Because she was late,\nshe left quickly.", "scope 10"); }
  { synomizer::Options o; o.synonyms=false; expect_eq(run("It was an honest and careful person.",o).text, "It was a careful and honest person.", "article after movement"); }
  { synomizer::Options o; expect_eq(run("Happy People",o).text, "Happy People", "title"); }
  { synomizer::Options o; o.synonyms=false; o.arrange=false; expect_eq(run("﻿\tA happy child.\r\n\n  \"happy\"\r",o).text, "﻿\tA happy child.\r\n\n  \"happy\"\r", "no op"); }

  expect_eq(run("She is likely to leave.").text,"She is likely to leave.","infinitive adjective frame");
  expect(contains(run("She found it difficult.").text,"found it"),"find object-complement frame");
  expect(contains(run("I remembered to help.").text,"remembered to"),"remember infinitive frame");
  expect(!contains(run("A frightened child arrived.").text,"afraid"),"predicative adjective not attributive");
  expect_eq(run("https://happy.example/thing(happy).").text,"https://happy.example/thing(happy).","URL punctuation literal");
  expect(contains(run("Visit HTTPS://happy.example/car.").text,"HTTPS://happy.example/car."),"uppercase URL literal");

  if (g_fails != 0) {
    std::cerr << g_fails << " failure(s)\n";
    return EXIT_FAILURE;
  }
  std::cout << "ok (" << g_checks << " assertions)\n";
  return EXIT_SUCCESS;
}
