# 筋トレは力なり（PWA）

筋トレ記録アプリ。ログインなしでも使え（端末内保存）、ログインすると記録がクラウドに保存されて別の端末でも続きから使えます。スクショのAI読み取り、ホーム画面に追加、オフライン記録に対応しています。

```
public/            ← 公開されるファイル（Cloudflare Pages の出力フォルダ）
  index.html app.css app.js   画面と動き
  store.js                    保存・ログイン・同期（Supabase）
  config.js                   Supabase の URL と anon キー（公開してよい値）
  sw.js manifest.webmanifest  PWA（オフライン・ホーム画面）
  privacy.html                プライバシーポリシー
  _headers                    セキュリティヘッダー
  icons/ vendor/              アイコン・supabase-js（自前で配信）
functions/         ← Cloudflare Pages Functions（AI読み取り）
  api/read-image.js           POST /api/read-image
  api/usage.js                GET  /api/usage
supabase/schema.sql  ← データベースの設計と権限（RLS）
```

APIキーなどの秘密の値は、**このリポジトリには入れません**。Cloudflare の環境変数にだけ入れます（手順3）。

---

## 公開までの手順

所要時間の目安は 60〜90 分です。上から順に進めてください。

### 0. 先に決めておくこと
- `public/privacy.html` の黄色い【　】の2か所（運営者名・連絡先メール）を、自分のものに書き換える。
- Supabase のメール送信を本番用にするため、メール送信サービス（Resend など）のアカウントを用意する（手順2-4）。

### 1. GitHub にリポジトリを作る
1. https://github.com/new を開き、Repository name に `kintore-pwa` と入れて作る（Private でも Public でも可。Cloudflare Pages はどちらも読めます）。「Add a README」などは**付けない**。
2. このフォルダ（`C:\dev\kintore-pwa`）で、PowerShell を開いて次を順に実行する（`あなたのユーザー名` は書き換える）。最初の1回だけ、`git config --global user.name` と `user.email` を設定していないと commit できません。
   ```powershell
   git add -A
   git commit -m "筋トレは力なり PWA 初版"
   git remote add origin https://github.com/あなたのユーザー名/kintore-pwa.git
   git push -u origin main
   ```
   `gh` コマンドが入っているなら、`gh repo create kintore-pwa --private --source . --push` でも作れます。

### 2. Supabase を用意する（保存とログイン）
1. https://supabase.com でアカウントを作り、**New project**。Region は `Northeast Asia (Tokyo)` を選ぶ。Database Password は自分で控えておく。
2. 左メニュー **SQL Editor** → New query に `supabase/schema.sql` の中身を全部貼り付けて **Run**。エラーなく終われば OK。
   - **Table Editor** で `workout_days` `user_meta` `ai_usage` の3つに「RLS enabled」と出ていることを確認する。
3. **Project Settings → API** を開き、次の2つを `public/config.js` に貼る（commit して push する）。
   - `Project URL` → `SUPABASE_URL`
   - `anon public` キー → `SUPABASE_ANON_KEY`
   - ⚠ `service_role` キーは `config.js` に**絶対に入れない**（手順3 で Cloudflare にだけ入れる）。
4. **Authentication → Emails → SMTP Settings** で Custom SMTP を有効にし、Resend などの送信設定を入れる。
   - 初期設定のままだと、メールは1時間に数通しか送れず、公開すると詰まります。
5. **Authentication → Emails → Templates** の **Confirm signup** と **Magic Link** の本文を、コードが出る形に書き換える。
   ```html
   <h2>ログイン用のコード</h2>
   <p>アプリの入力欄に、次の数字を入れてください。</p>
   <p style="font-size:28px;letter-spacing:4px"><b>{{ .Token }}</b></p>
   ```
   （リンクではなくコードを入力する方式にしているのは、ホーム画面に追加したアプリで、メールのリンクがSafariで開いてしまうためです。）
6. **Authentication → Sign In / Providers → Email** は有効のまま。Email OTP の長さ（Length）は `6` のままで OK。
7. **Google ログインを使う場合**
   1. https://console.cloud.google.com でプロジェクトを作り、**APIとサービス → OAuth 同意画面** を設定する（外部、アプリ名「筋トレは力なり」、メールだけのスコープ）。
   2. **認証情報 → 認証情報を作成 → OAuth クライアント ID → ウェブ アプリケーション**。
   3. 「承認済みのリダイレクト URI」に `https://<あなたのプロジェクトID>.supabase.co/auth/v1/callback` を入れる（Supabase の Providers → Google の画面にコピー用の URL が出ています）。
   4. できた Client ID と Client Secret を、Supabase の **Providers → Google** に貼って有効にする。
8. **Authentication → URL Configuration**（手順4のあとでもう一度確認）
   - Site URL: `https://あなたのアプリのURL`
   - Redirect URLs: 同じURLと、`http://localhost:8788`（手元で試すとき用）

### 3. Cloudflare Pages で公開する
1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** で、手順1のリポジトリを選ぶ。
2. 設定は次のとおり。
   - Framework preset: `None`
   - Build command: **空のまま**
   - Build output directory: `public`
3. **Environment variables** に次を入れる（Production と Preview の両方）。**秘密の値は「Encrypt」を押す。**

   | 名前 | 値 | 秘密 |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | Anthropic の API キー | はい |
   | `SUPABASE_URL` | Project URL | いいえ |
   | `SUPABASE_ANON_KEY` | Publishable key（旧 anon public） | いいえ |
   | `SUPABASE_SERVICE_ROLE_KEY` | Secret key（旧 service_role）。Supabase の API Keys 画面で作る/表示する | **はい** |
   | `MODEL` | 省略可。初期値 `claude-haiku-5-5`。読み間違いが多ければ `claude-sonnet-5-5` | いいえ |
   | `MONTHLY_LIMIT` | 省略可。初期値 `50` | いいえ |

4. **Save and Deploy**。終わると `https://xxxx.pages.dev` のURLができる。
5. そのURLを、手順2の 8（Supabase の Site URL と Redirect URLs）に入れる。
6. Anthropic のコンソール（https://console.anthropic.com）で API キーを作り、**月の利用上限（Spend limit）を必ず設定**しておく。

> 環境変数を変えたあとは、Pages の **Deployments → Retry deployment**（または空の commit を push）で反映されます。

### 4. 動作確認
- [ ] ログインなしで記録を入れられる（右上が「端末に保存中」）
- [ ] メールのコードでログインできる。Google でもログインできる（右上が「✓ 自動保存中」）
- [ ] 別の端末（またはシークレットウィンドウ）で同じアカウントにログインすると、同じ記録が出る
- [ ] 2つ目のアカウントでは、1つ目の記録が**見えない**
- [ ] 機内モードで記録 → 電波を戻すと「同期待ち」が消える
- [ ] 以前のバックアップ（version 1 / 2 のJSON）を「メニュー → 保存・ログイン → ファイルから戻す」で読み込める
- [ ] スクショを1枚読み取れる。「今月 1 / 50枚」と出る
- [ ] スマホで、振り返りカードの「画像を保存」→ 共有メニュー →「画像を保存」で写真に入る
- [ ] iPhone: Safari の共有 →「ホーム画面に追加」。Android: メニュー →「アプリをインストール」
- [ ] テスト用アカウントで「アカウントと記録をすべて消す」が動く

### 5. 更新するとき
`git push` するだけで、Cloudflare Pages が自動で作り直します。アプリのファイル（`app.js` など）は「まずネット、遅いときだけ保存分」で配信するので、ユーザーには次に開いたとき新しい版が届きます。

---

## 手元で動かす（任意）
Node.js が必要です。

```powershell
# 秘密の値は .dev.vars に書く（.gitignore で除外済み）。.dev.vars.example をコピーして埋める
npx wrangler pages dev public --port 8788
```

## しくみのメモ
- **保存**: 入力すると端末（localStorage）にすぐ保存し、変えた日だけ「未送信リスト」に積んで Supabase へ送ります。送れなかった分は端末に残り、つながったら自動で再送します。
- **記録を消すとき**: 行は消さず、`entries` を空にして送ります（別の端末にも消えたことが伝わるように）。アカウントを消すときは、`delete_my_account()` が行を消します。
- **権限**: 3つのテーブルすべてに RLS。`auth.uid() = user_id` の行だけ読み書きできます。`ai_usage` の増減は service_role だけです。
- **AI読み取り**: ブラウザは画像（縮小済みJPEG）だけを `/api/read-image` に送ります。指示文・APIキー・上限の管理はすべてサーバー側です。失敗した分は枚数に数えません。
- **バックアップ**: `{app:"tsumitore", version:1|2, ...}` の両方を読み込めます（中身は検査してから取り込みます）。
