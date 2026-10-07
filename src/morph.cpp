// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

#include "internal.hpp"

#include <unordered_set>
#include <utility>

namespace synomizer {
namespace {

struct VerbForms {
  std::string_view base;
  std::string_view third;
  std::string_view past;
  std::string_view part;
  std::string_view gerund;
};

constexpr VerbForms k_verbs[] = {
    {"keep", "keeps", "kept", "kept", "keeping"},
    {"show", "shows", "showed", "shown", "showing"},
    {"buy", "buys", "bought", "bought", "buying"},
    {"find", "finds", "found", "found", "finding"},
    {"eat", "eats", "ate", "eaten", "eating"},
    {"build", "builds", "built", "built", "building"},
    {"choose", "chooses", "chose", "chosen", "choosing"},
    {"understand", "understands", "understood", "understood", "understanding"},
    {"hide", "hides", "hid", "hidden", "hiding"},
    {"sleep", "sleeps", "slept", "slept", "sleeping"},
    {"begin", "begins", "began", "begun", "beginning"},
};

struct NounForms {
  std::string_view singular;
  std::string_view plural;
};

constexpr NounForms k_nouns[] = {
    {"child", "children"}, {"person", "people"}, {"man", "men"},     {"woman", "women"},
    {"mouse", "mice"},     {"goose", "geese"},   {"tooth", "teeth"}, {"foot", "feet"},
    {"ox", "oxen"},
};

bool is_vowel_char(char c) {
  switch (ascii_lower(static_cast<unsigned char>(c))) {
    case 'a':
    case 'e':
    case 'i':
    case 'o':
    case 'u':
    case 'y':
      return true;
    default:
      return false;
  }
}

int vowel_groups(std::string_view word) {
  int count = 0;
  bool in_group = false;
  for (char c : word) {
    if (is_vowel_char(c)) {
      if (!in_group) {
        ++count;
      }
      in_group = true;
    } else {
      in_group = false;
    }
  }
  return count;
}

bool cvc_last(std::string_view word) {
  if (word.size() < 3 || vowel_groups(word) != 1) {
    return false;
  }
  const char a = word[word.size() - 3];
  const char b = word[word.size() - 2];
  const char c = word[word.size() - 1];
  if (is_vowel_char(a) || !is_vowel_char(b) || is_vowel_char(c)) {
    return false;
  }
  return c != 'w' && c != 'x' && c != 'y';
}

bool should_double(std::string_view lemma) {
  if (lemma == "permit" || lemma == "occur") {
    return true;
  }
  if (!cvc_last(lemma)) {
    return false;
  }
  return true;
}

bool is_sibilant(std::string_view word) {
  return word.ends_with("ch") || word.ends_with("sh") || word.ends_with('s') || word.ends_with('x') ||
         word.ends_with('z');
}

bool consonant_y(std::string_view word) {
  return word.size() >= 2 && word.ends_with('y') && !is_vowel_char(word[word.size() - 2]);
}

bool same_features(const Features& a, const Features& b) {
  return a.plural == b.plural && a.third == b.third && a.past == b.past && a.participle == b.participle &&
         a.gerund == b.gerund && a.comparative == b.comparative && a.superlative == b.superlative &&
         a.possessive == b.possessive;
}

bool is_contraction(std::string_view word) {
  return word.ends_with("n't") || word.ends_with("'re") || word.ends_with("'ve") || word.ends_with("'ll") ||
         word.ends_with("'d") || word.ends_with("'m") || word.ends_with("'t");
}

const VerbForms* verb_by_base(std::string_view lemma) {
  for (const VerbForms& forms : k_verbs) {
    if (forms.base == lemma) {
      return &forms;
    }
  }
  return nullptr;
}

const VerbForms* verb_by_surface(std::string_view surface) {
  for (const VerbForms& forms : k_verbs) {
    if (surface == forms.base || surface == forms.third || surface == forms.past || surface == forms.part ||
        surface == forms.gerund) {
      return &forms;
    }
  }
  return nullptr;
}

std::optional<std::string_view> singular_of_plural(std::string_view surface) {
  for (const NounForms& forms : k_nouns) {
    if (surface == forms.plural) {
      return forms.singular;
    }
  }
  return std::nullopt;
}

std::optional<std::string_view> plural_of_singular(std::string_view lemma) {
  for (const NounForms& forms : k_nouns) {
    if (lemma == forms.singular) {
      return forms.plural;
    }
  }
  return std::nullopt;
}

bool irregular_detection_surface(std::string_view word) {
  static const std::unordered_set<std::string_view> words = {
      "said",   "went",   "gone",  "came",   "made",   "took",   "taken", "got",    "gotten", "saw",    "seen",
      "gave",   "given",  "told",  "thought","knew",   "known",  "felt",   "kept",   "meant",  "heard",  "held",
      "brought","caught", "taught","spoke",  "spoken", "wrote",  "written","sat",   "stood",  "grew",   "grown",
      "fell",   "fallen", "won",   "lost",   "sent",   "paid",   "met",    "led",    "cut",    "put",    "let",
      "set",    "hit",    "read",  "cost",   "quit",   "became", "left",   "ran",    "drove",  "driven", "broke",
      "broken", "wore",   "worn",  "threw",  "thrown", "swam",   "swum",   "sang",   "sung",   "rang",   "hung",
      "stuck",  "struck", "meant", "sold",   "told",   "found",  "built",  "bought", "chose",  "chosen", "ate",
      "eaten",  "slept",  "hid",   "hidden", "understood", "began", "begun", "did",  "done",   "went"};
  return words.contains(word);
}

std::optional<std::string> grade_adjective(std::string_view lemma, bool superlative) {
  if (lemma == "huge" || lemma == "little" || lemma == "glad") {
    return std::nullopt;
  }
  const std::string_view suffix = superlative ? "est" : "er";
  const std::string_view y_suffix = superlative ? "iest" : "ier";
  auto blocked = [](const std::string& word) {
    return word == "littler" || word == "littlest" || word == "gladder" || word == "gladdest" || word == "huger" ||
           word == "hugest";
  };

  if (consonant_y(lemma) && vowel_groups(lemma) <= 2) {
    std::string word(lemma.substr(0, lemma.size() - 1));
    word += y_suffix;
    if (blocked(word)) {
      return std::nullopt;
    }
    return word;
  }
  if (lemma.ends_with('e') && !lemma.ends_with("ee")) {
    const std::string stem(lemma.substr(0, lemma.size() - 1));
    const int groups = vowel_groups(stem);
    if (!(groups <= 1 || lemma.ends_with("le"))) {
      return std::nullopt;
    }
    std::string word = stem;
    word += suffix;
    if (blocked(word)) {
      return std::nullopt;
    }
    return word;
  }
  if (vowel_groups(lemma) != 1) {
    return std::nullopt;
  }
  std::string word(lemma);
  if (cvc_last(lemma)) {
    static const std::unordered_set<std::string_view> doubling = {"big", "hot", "sad", "thin", "fat", "red",
                                                                   "dim", "wet", "fit"};
    if (!doubling.contains(lemma)) {
      return std::nullopt;
    }
    word.push_back(lemma.back());
  }
  word += suffix;
  if (blocked(word)) {
    return std::nullopt;
  }
  return word;
}

std::string regular_past(std::string_view lemma) {
  if (consonant_y(lemma)) {
    return std::string(lemma.substr(0, lemma.size() - 1)) + "ied";
  }
  if (lemma.ends_with('e')) {
    return std::string(lemma) + "d";
  }
  if (should_double(lemma)) {
    std::string word(lemma);
    word.push_back(lemma.back());
    word += "ed";
    return word;
  }
  return std::string(lemma) + "ed";
}

std::string regular_gerund(std::string_view lemma) {
  if (lemma.size() > 2 && lemma.ends_with("ie")) {
    return std::string(lemma.substr(0, lemma.size() - 2)) + "ying";
  }
  if (lemma.ends_with('e') && !lemma.ends_with("ee") && !lemma.ends_with("oe") && !lemma.ends_with("ye")) {
    return std::string(lemma.substr(0, lemma.size() - 1)) + "ing";
  }
  if (should_double(lemma)) {
    std::string word(lemma);
    word.push_back(lemma.back());
    word += "ing";
    return word;
  }
  return std::string(lemma) + "ing";
}

std::string regular_third(std::string_view lemma) {
  if (consonant_y(lemma)) {
    return std::string(lemma.substr(0, lemma.size() - 1)) + "ies";
  }
  if (is_sibilant(lemma)) {
    return std::string(lemma) + "es";
  }
  return std::string(lemma) + "s";
}

std::string regular_plural(std::string_view lemma) {
  if (lemma == "aircraft") return "aircraft";
  static const std::unordered_set<std::string_view> f_to_ves = {
      "leaf", "loaf", "wife", "life", "knife", "wolf", "half", "calf", "shelf", "self", "thief"};
  if (f_to_ves.contains(lemma)) {
    if (lemma.ends_with("fe")) {
      return std::string(lemma.substr(0, lemma.size() - 2)) + "ves";
    }
    return std::string(lemma.substr(0, lemma.size() - 1)) + "ves";
  }
  if (consonant_y(lemma)) {
    return std::string(lemma.substr(0, lemma.size() - 1)) + "ies";
  }
  if (is_sibilant(lemma)) {
    return std::string(lemma) + "es";
  }
  return std::string(lemma) + "s";
}

}  // namespace

std::optional<std::string> inflect(std::string_view lemma, Pos pos, const Features& features) {
  if (pos == Pos::Adv) {
    if (features.plural || features.past || features.gerund || features.comparative || features.superlative ||
        features.third || features.participle) {
      return std::nullopt;
    }
    return std::string(lemma);
  }
  if (pos == Pos::Adj) {
    if (features.comparative || features.superlative) {
      if (auto form = grade_adjective(lemma, features.superlative)) return form;
      static const std::unordered_set<std::string_view> analytic = {"careful", "cautious", "cheerful", "joyful", "pleased", "sorrowful", "unhappy", "irate", "angry", "clever", "intelligent", "powerful", "beautiful", "lovely", "attractive", "difficult", "challenging", "important", "significant", "useful", "helpful", "polite", "courteous", "brave", "courageous", "expensive", "costly", "reliable", "dependable", "concise", "succinct", "enormous", "immense", "obvious", "evident", "apparent", "complicated", "intricate", "peaceful", "tranquil", "eager", "enthusiastic", "tired", "weary", "frightened", "scared", "generous", "charitable", "considerate", "thoughtful", "serious", "solemn", "funny", "amusing", "humorous", "boring", "tedious", "interesting", "engaging", "common", "ordinary", "rare", "uncommon", "distant", "remote", "pleasant", "awful", "terrible", "wonderful", "marvelous", "grateful", "thankful", "busy", "occupied", "prepared", "wide", "broad", "similar", "comparable", "different", "distinct", "short", "brief", "strong", "weak", "frail", "easy", "simple", "small", "big", "large", "safe", "secure"};
      if (analytic.contains(lemma)) return std::string(features.superlative ? "most " : "more ") + std::string(lemma);
      return std::nullopt;
    }
    if (features.plural || features.past || features.gerund || features.third) {
      return std::nullopt;
    }
    return std::string(lemma);
  }
  if (pos == Pos::Noun) {
    if (features.past || features.gerund || features.third || features.comparative) {
      return std::nullopt;
    }
    if (!features.plural) {
      return std::string(lemma);
    }
    if (const auto plural = plural_of_singular(lemma)) {
      return std::string(*plural);
    }
    return regular_plural(lemma);
  }
  if (pos == Pos::Verb) {
    if (const VerbForms* forms = verb_by_base(lemma)) {
      if (features.gerund) {
        return std::string(forms->gerund);
      }
      if (features.third) {
        return std::string(forms->third);
      }
      if (features.participle) {
        return std::string(forms->part);
      }
      if (features.past) {
        return std::string(forms->past);
      }
      return std::string(forms->base);
    }
    if (features.gerund) {
      return regular_gerund(lemma);
    }
    if (features.third) {
      return regular_third(lemma);
    }
    if (features.past || features.participle) {
      return regular_past(lemma);
    }
    if (features.comparative || features.superlative || features.plural) {
      return std::nullopt;
    }
    return std::string(lemma);
  }
  return std::nullopt;
}

std::vector<Analysis> analyze_word(std::string_view surface, std::string_view /*previous*/, bool participle_context) {
  std::string raw = lower_copy(surface);
  for (unsigned char c : raw) {
    if (c >= 128) {
      return {};
    }
  }
  if (raw.empty() || is_contraction(raw)) {
    return {};
  }
  bool possessive = false;
  if (raw.ends_with("'s") && raw.size() > 2) {
    raw.resize(raw.size() - 2);
    possessive = true;
  } else if (raw.ends_with("s'") && raw.size() > 2) {
    raw.pop_back();
    possessive = true;
  } else if (raw.find('\'') != std::string::npos) {
    return {};
  }

  std::vector<Analysis> found;
  auto add = [&](const std::string& lemma, Pos pos, Features features) {
    const std::optional<Analysis> entry = lexicon().find(lemma, pos);
    if (!entry) {
      return;
    }
    Analysis analysis = *entry;
    features.possessive = possessive;
    analysis.features = features;
    for (const Analysis& existing : found) {
      if (existing.lemma == analysis.lemma && existing.pos == analysis.pos &&
          same_features(existing.features, analysis.features)) {
        return;
      }
    }
    found.push_back(std::move(analysis));
  };

  for (const Analysis& entry : lexicon().entries_for(raw)) {
    add(entry.lemma, entry.pos, Features{});
  }
  if (const auto singular = singular_of_plural(raw)) {
    Features features;
    features.plural = true;
    add(std::string(*singular), Pos::Noun, features);
  }
  if (const VerbForms* forms = verb_by_surface(raw)) {
    Features features;
    if (raw == forms->gerund && raw != forms->base) {
      features.gerund = true;
    } else if (raw == forms->third && raw != forms->base) {
      features.third = true;
    } else if (raw == forms->past && raw == forms->part && raw != forms->base) {
      if (participle_context) {
        features.participle = true;
      } else {
        features.past = true;
      }
    } else if (raw == forms->past && raw != forms->base) {
      features.past = true;
    } else if (raw == forms->part && raw != forms->base) {
      features.participle = true;
    }
    if (features.gerund || features.third || features.past || features.participle) {
      add(std::string(forms->base), Pos::Verb, features);
    }
  }

  Features tense;
  if (participle_context) {
    tense.participle = true;
  } else {
    tense.past = true;
  }
  auto add_tense = [&](const std::string& lemma) { add(lemma, Pos::Verb, tense); };
  auto add_ing = [&](const std::string& lemma) {
    Features features;
    features.gerund = true;
    add(lemma, Pos::Verb, features);
  };

  if (raw.ends_with("ied") && raw.size() > 3) {
    add_tense(raw.substr(0, raw.size() - 3) + "y");
  }
  if (raw.ends_with("ed") && raw.size() > 3) {
    const std::string stem = raw.substr(0, raw.size() - 2);
    add_tense(stem);
    if (stem.size() >= 2 && stem.back() == stem[stem.size() - 2] && !is_vowel_char(stem.back())) {
      add_tense(stem.substr(0, stem.size() - 1));
    }
  }
  if (raw.size() > 2 && raw.ends_with('d') && raw[raw.size() - 2] == 'e') {
    add_tense(raw.substr(0, raw.size() - 1));
  }
  if (raw.ends_with("ying") && raw.size() > 4) {
    add_ing(raw.substr(0, raw.size() - 4) + "ie");
  }
  if (raw.ends_with("ing") && raw.size() > 4) {
    const std::string stem = raw.substr(0, raw.size() - 3);
    add_ing(stem);
    add_ing(stem + "e");
    if (stem.size() >= 2 && stem.back() == stem[stem.size() - 2] && !is_vowel_char(stem.back())) {
      add_ing(stem.substr(0, stem.size() - 1));
    }
  }

  Features plural;
  plural.plural = true;
  Features third;
  third.third = true;
  auto add_s = [&](const std::string& lemma) {
    add(lemma, Pos::Noun, plural);
    add(lemma, Pos::Verb, third);
  };
  if (raw.ends_with("ies") && raw.size() > 3) {
    add_s(raw.substr(0, raw.size() - 3) + "y");
  }
  if (raw.ends_with("es") && raw.size() > 3) {
    const std::string stem = raw.substr(0, raw.size() - 2);
    if (is_sibilant(stem)) {
      add_s(stem);
    }
  }
  if (raw.ends_with('s') && !raw.ends_with("ss") && raw.size() > 2) {
    add_s(raw.substr(0, raw.size() - 1));
  }

  auto add_grade = [&](const std::string& lemma, bool superlative) {
    Features features;
    if (superlative) {
      features.superlative = true;
    } else {
      features.comparative = true;
    }
    add(lemma, Pos::Adj, features);
  };
  if (raw.ends_with("ier") && raw.size() > 3) {
    add_grade(raw.substr(0, raw.size() - 3) + "y", false);
  }
  if (raw.ends_with("iest") && raw.size() > 4) {
    add_grade(raw.substr(0, raw.size() - 4) + "y", true);
  }
  if (raw.ends_with("er") && raw.size() > 3 && !raw.ends_with("eer")) {
    const std::string stem = raw.substr(0, raw.size() - 2);
    add_grade(stem, false);
    add_grade(stem + "e", false);
    if (stem.size() >= 2 && stem.back() == stem[stem.size() - 2] && !is_vowel_char(stem.back())) {
      add_grade(stem.substr(0, stem.size() - 1), false);
    }
  }
  if (raw.ends_with("est") && raw.size() > 4 && !raw.ends_with("eest")) {
    const std::string stem = raw.substr(0, raw.size() - 3);
    add_grade(stem, true);
    add_grade(stem + "e", true);
    if (stem.size() >= 2 && stem.back() == stem[stem.size() - 2] && !is_vowel_char(stem.back())) {
      add_grade(stem.substr(0, stem.size() - 1), true);
    }
  }
  return found;
}

bool looks_like_verb_token(std::string_view word) {
  const std::string low = lower_copy(word);
  if (low.empty()) {
    return false;
  }
  if (is_aux(low) || irregular_detection_surface(low)) {
    return true;
  }
  const std::vector<Analysis> analyses = analyze_word(low, "", false);
  for (const Analysis& analysis : analyses) {
    if (analysis.pos == Pos::Verb) {
      return true;
    }
  }
  if (low.size() >= 5 && low.ends_with("ed") && !low.ends_with("eed") && !lexicon().has_lemma(low)) {
    return true;
  }
  return false;
}

}  // namespace synomizer
