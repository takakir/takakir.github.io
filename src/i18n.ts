// Bilingual content (JP default / EN). Keys are referenced via data-i18n
// in markup; the client runtime swaps innerHTML on toggle.
export type Lang = "ja" | "en";

export const dict: Record<string, { ja: string; en: string }> = {
  "nav.concept": { ja: "流儀", en: "The Way" },
  "nav.contact": { ja: "コンタクト", en: "Contact" },

  "hero.l1": { ja: "匠の技と", en: "Where Craft" },
  "hero.l2": { ja: "テクノロジーの融合", en: "Meets Technology" },
  "hero.lead": {
    ja: "受け継がれた手仕事の精緻さを、データとAIの力で次の時代へ。",
    en: "Carrying the precision of Japanese handcraft into the next era — with data and AI.",
  },
  "hero.cta1": { ja: "流儀を見る", en: "Explore the Way" },
  "hero.cta2": { ja: "コンタクト", en: "Get in Touch" },
  "hero.scroll": { ja: "SCROLL", en: "SCROLL" },

  "concept.en": { ja: "THE WAY", en: "THE WAY" },
  "concept.title": { ja: "匠の技とテクノロジーの融合", en: "The Fusion of Craft & Technology" },
  "concept.lead": {
    ja: "日本のものづくりが磨き上げてきたのは、細部への執着、再現性、そして「間（ま）」の感覚。その暗黙知をデータとして捉え直し、AIと共に増幅させることで、技は失われずに、より遠くへ届きます。",
    en: "Japanese craftsmanship has refined an obsession with detail, reproducibility, and a sense of “ma” — the space between. By recapturing that tacit knowledge as data and amplifying it with AI, the craft is not lost: it reaches further.",
  },
  "concept.p1.t": { ja: "匠の精度", en: "Artisan Precision" },
  "concept.p1.d": { ja: "手仕事に宿る精緻さと判断を、構造化されたデータと工程として可視化する。", en: "Make the precision and judgement of handcraft visible as structured data and process." },
  "concept.p2.t": { ja: "AI・データの知性", en: "AI & Data Intelligence" },
  "concept.p2.d": { ja: "生成AI・機械学習に加え、データスペースの設計で暗黙知をつなぎ、活かし、意思決定を支援する。", en: "Beyond generative AI and ML, we design data spaces that connect and activate tacit knowledge to support decisions." },
  "concept.p3.t": { ja: "調和の設計", en: "Harmonious Design" },
  "concept.p3.d": { ja: "人と技術が互いを引き立てる、持続可能で美しいワークフローをデザインする。", en: "Design sustainable, beautiful workflows where people and technology elevate one another." },

  "band.en": { ja: "THE CRAFT", en: "THE CRAFT" },
  "band.line": { ja: "受け継がれた手仕事に、敬意を。", en: "In reverence of inherited handcraft." },

  "contact.en": { ja: "CONTACT", en: "CONTACT" },
  "contact.title": { ja: "共に、次の技を編む。", en: "Let’s weave the next craft, together." },
  "contact.lead": { ja: "匠の技とテクノロジーを結ぶプロジェクトのご相談を承ります。", en: "I welcome conversations about projects that bring craftsmanship and technology together." },
  "contact.linkedin": { ja: "LinkedInでつながる", en: "Connect on LinkedIn" },

  "footer.tag": { ja: "匠の技 × テクノロジー", en: "Craftsmanship × Technology" },
};

// Flatten to { key: en } for the client runtime (JA lives in the DOM).
export const EN: Record<string, string> = Object.fromEntries(
  Object.entries(dict).map(([k, v]) => [k, v.en])
);
