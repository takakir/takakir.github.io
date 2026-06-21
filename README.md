# TAKAKI.ai

**TAKAKI.ai** の公式サイト。**Astro + React島 + Three.js(WebGL) + GSAP** による
動的なシングルページ。

> 匠の技 × テクノロジー
> _Craftsmanship × Technology_

## 概要

- **匠の技とテクノロジーの融合** — 日本のものづくりが磨いてきた暗黙知を、AIとデータスペースで次の時代へ。
- WebGLシェーダーのヒーロー（鍛冶の火花／溶けた金属を想起させる粒子）で「最先端」を表現。
- 構成は **ヒーロー → 流儀（THE WAY）→ コンタクト** のシンプルな3部構成。
- ブランドマーク／favicon には**家紋「丸に片喰」**を藍×金にリカラーして使用（`public/kamon.png`）。
- 日本語 / English のバイリンガル（右上トグル）。

コンタクト: LinkedIn <https://www.linkedin.com/in/takakir/>

## 技術スタック

| 役割 | 技術 |
|---|---|
| フレームワーク | [Astro](https://astro.build)（静的書き出し） |
| インタラクティブ島 | React 18 |
| 3D / WebGL | Three.js（カスタムGLSLシェーダーの点群＋火花） |
| スクロール演出 | GSAP ScrollTrigger + [Lenis](https://lenis.darkroom.engineering)（慣性スクロール） |
| スタイル | Tailwind CSS |
| 多言語 | 日本語 / English トグル（`src/i18n.ts`） |

## ディレクトリ

```
.
├── src/
│   ├── pages/index.astro          # ページ本体（ヒーロー / 流儀 / コンタクト）
│   ├── layouts/Base.astro         # <head>・メタ情報・フォント・ランタイム読込
│   ├── components/
│   │   ├── Hero3D.tsx             # Three.js ヒーロー（React島）
│   │   └── Nav.astro             # ナビ＋言語トグル（モバイルメニュー含む）
│   ├── scripts/runtime.ts        # Lenis+GSAP+言語切替+ナビ制御
│   ├── styles/global.css         # Tailwind＋共通スタイル
│   └── i18n.ts                   # 日英の文言
├── public/
│   ├── CNAME                     # カスタムドメイン takaki.ai
│   └── kamon.png                 # 家紋ロゴ／favicon（藍×金）
└── .github/workflows/deploy.yml   # GitHub Actions で Pages へ自動デプロイ
```

## 開発

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # dist/ に静的出力
npm run preview   # ビルド結果をプレビュー
```

## ライセンス

[MIT License](LICENSE) © 2026 TAKAKI.ai

※ 家紋（`public/kamon.png`）は所有者の家紋を意匠化したもので、商標的・個人的
権利は所有者に帰属します。
