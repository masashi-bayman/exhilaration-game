# EXHILARATION — 皿割りブレイカー

「割る」「繋ぐ」「増える」「数字が爆発する」を全部詰め込んだ、爽快感特化のブラウザゲーム。
**依存ライブラリなし・ビルド不要。PWA なので iPhone / Android にストアを通さず入れられます。**

```
git clone https://github.com/masashi-bayman/exhilaration-game.git
cd exhilaration-game
python3 deploy/serve.py        # → http://localhost:8080/
```

`index.html` をブラウザに直接ドロップしても遊べますが、
オフライン再生（Service Worker）とホーム画面への追加は **http(s) 経由** が必要です。

配信・インストール手順は [📱 スマホに入れる](#-スマホに入れるストア不要) /
[🌐 GitHub Pages](#-github-pages-で公開する) / [🍓 ラズパイ](#-ラズパイで動かす) を参照。

---

## どういうゲーム？

ブロック崩しの姿をした「皿割り機」です。パドルでボールを弾いて、並んだ皿を粉々にします。

爽快感の設計は3本柱:

| 柱 | 仕掛け |
|---|---|
| **割る快感** | 皿は多角形の破片になって飛び散る。割るたびに画面が揺れ、ヒットストップが入り、破砕音が鳴る |
| **繋ぐ快感** | コンボが続く限り**破砕音の音階が上がり続ける**（ペンタトニック）。背景に巨大なコンボ数字が浮かび、画面全体が発光していく |
| **増える快感** | BURST 中は皿を割るたびにボールが**ねずみ算式に増殖**（最大44〜64個）。スコアは指数関数的に跳ね上がる |
| **育つ快感** | 皿を割ると経験値。レベルアップのたび**3つの強化から1つ選ぶ**（ヴァンサバ方式）。重ねるほど1プレイが壊れていく |

---

## 2つのモード

### おきらく
- **ボールは絶対に落ちない**（床が跳ね返す）。ミスの概念がない
- パドルが広い / 開幕から3ボール / ゲージの溜まりが速い / BURST は満タンで自動発動
- とにかく割って、音階を駆け上がって、画面を虹色にするためのモード

### ガチ
- 残機3。落としたら終わり。そのぶん**スコア倍率 x1.6**
- テクを決めるとリターンが跳ね上がる設計:
  - **ジャストガード** — ボールがパドルに当たる直前に `SHIFT`(または `J` / 右クリック)。成功すると**5枚貫通する金色の弾**になり、コンボ +4、特大ボーナス、ゲージ大幅増。失敗すると 0.45 秒の硬直
  - **EDGE ヒット** — パドルの両端（緑のマーカー部分）で返すと鋭角に飛び、コンボ +1 とボーナス
  - **BURST の使いどころ** — 満タンでも自動発動しない。`E` を押すのはプレイヤー。皿が密集している場所を残しておいて撃つと稼ぎが跳ねる
- ジャストガードが決まった瞬間の「キィン」＋金色の衝撃波＋貫通が、このゲームの一番おいしい所です

---

## レベルアップと3択強化

皿を割ると**経験値**が溜まり、バーが満タンになると時間が止まって
**3枚のカードから1つ選ぶ**画面が出ます。選んだ強化はその1プレイの間ずっと残り、
重ねるほど盤面が加速度的に壊れていきます。

- 選択は **`1` / `2` / `3` キー**、クリック、タップのいずれでも
- 「🔄 引き直し券」を持っていれば **`R`** または画面のボタンで3枚を引き直せる
- **BURST 中はレベルアップが出ません**。BURST が終わってからまとめて選びます
  （一番おいしい瞬間に水を差さないため）
- 一気に複数レベル上がったときは、その回数ぶん連続で選べます
- 取得済みの強化は**ポーズ画面**と**ゲームオーバー画面**で一覧できます

必要経験値は `round(6 × 1.16^(Lv-1))`。序盤はポンポン上がり、後半はゆっくりになります。
厚皿は2、鉄皿は3、爆発皿は2の経験値が入ります。

### 強化一覧（全20種）

| | 強化 | 上限 | 効果（1段あたり） |
|---|---|---|---|
| 🧺 | 大皿トレイ | 5 | パドルの幅 +13% |
| 🍽️ | 追加注文 | 5 | 持ちボール +1 |
| 💎 | ダイヤカッター | 5 | 割るとき 14% で貫通（跳ね返らず突き抜ける） |
| 💥 | 衝撃波 | 5 | 割るとき 12% で小爆発。巻き込んで連鎖 |
| ⚡ | 電撃連鎖 | 4 | 割るとき 20% で近くの皿にも連鎖 |
| 🧬 | 分裂 | 4 | 割るとき 9% でボールが1個増える |
| 🌀 | 連鎖の呼吸 | 4 | コンボ持続 +0.35秒 |
| 💰 | 高級皿 | 5 | 獲得スコア +22% |
| 🔌 | 速充電 | 4 | BURST ゲージの溜まり +28% |
| ⏱️ | 延長コード | 4 | BURST 時間 +1.6秒 |
| 🚀 | 加速装置 | 5 | ボール速度 +7% ／ スコア +8%（速いほど難しい） |
| ⚪ | 特大ボール | 4 | ボールの大きさ +18% |
| 🧲 | 皿レーダー | 3 | 上がっていくボールが皿へ吸い寄せられる |
| 💪 | 怪力 | 2 | 硬い皿へのダメージ +1（鉄皿を一撃で割れる） |
| ✸ | 爆発皿の増設 | 3 | 各ウェーブの爆発皿 +2 |
| 📘 | 経験の蓄積 | 4 | 獲得経験値 +30% |
| 🔄 | 引き直し券 | 3 | 強化の引き直しが +1 回 |
| ❤️ | 予備の皿 | 3 | 残機 +1 **（ガチ専用）** |
| 👁️ | 見切り | 3 | ジャストガードの受付時間 +35% **（ガチ専用）** |
| 🕸️ | 安全ネット | 3 | 落下を N 回まで防ぐ。ウェーブごとに回復 **（ガチ専用）** |

カードの枠色はレア度です（青 → 水色 → 金）。金枠は一段で戦況が変わる当たり。
すべて上限まで取り切ると、代わりに「💠 ごほうび」（即時大量スコア）が出ます。

定義は `js/upgrades.js` の `LIST` にまとまっているので、
数値をいじったり強化を足したりするのはそこだけで済みます。

---

## 操作

| 操作 | キー |
|---|---|
| パドル移動 | マウス / `←` `→` / `A` `D` |
| 発射 | `SPACE` / クリック |
| ジャストガード | `SHIFT` / `J` / 右クリック |
| BURST 発動 | `E` / `F` / `K` |
| 強化を選ぶ | `1` / `2` / `3`（レベルアップ中） |
| 強化を引き直す | `R`（レベルアップ中・引き直し券が必要） |
| 一時停止 | `P` / `ESC` |
| 消音 | `M` |
| リトライ / タイトル | `R` / `T` |

スマホ・タブレットではドラッグでパドル移動、タップで発射、画面下の `GUARD` / `BURST` ボタンが出ます。

---

## 皿の種類

| 見た目 | 種類 | 挙動 |
|---|---|---|
| 通常色 | 普通の皿 | 一撃 |
| オレンジ | 厚皿 | 2回 |
| グレー（数字入り） | 鉄皿 | 3回 |
| 金色 `✸` | 爆発皿 | 半径108pxを巻き込んで**連鎖爆発**。コンボが一気に伸びる |

ウェーブが進むほど硬い皿が増え、爆発皿も増えます。

---

## スコアの伸び方（数字が爆発する仕組み）

```
1皿あたり = 100 × 皿の価値 × ウェーブ倍率 × (1 + コンボ×0.12) × BURST倍率(x3) × モード倍率
                              ↑1.28^(wave-1)
```

ウェーブ10 でウェーブ倍率は約 x8.6、コンボ50 で x7、BURST で x3。
掛け合わさると 1 皿で数万点入ります。BURST 中は中央に累計獲得点がリアルタイムで積み上がります。

さらに:
- ウェーブクリアで残機・最大コンボに応じた大量ボーナス
- BURST 終了時、余ったボールが 1 個ずつスコアに変換されて消える（後片付けも気持ちよく）
- コンボ25ごとに EXTRA BALL

ベストスコアはモード別に `localStorage` に保存されます。

---

## ステージ

`FULL / CHECKER / PYRAMID / ARCH / STRIPES / DIAMOND / FRAME / CROSS / ZIGZAG / TOWER` の10形状が
順番に出現し、一巡するごとに1行ずつ厚くなります（最大8行）。エンドレスです。

---

## 構成

```
index.html        画面とオーバーレイUI
css/style.css     UI スタイル
js/audio.js       WebAudio による効果音シンセ（音声ファイル不要）
js/fx.js          破片 / 火花 / 飛ぶ数字 / 衝撃波 / 画面揺れ / ヒットストップ
js/levels.js      ウェーブごとの皿レイアウト生成
js/upgrades.js    3択強化の定義とカードの抽選
js/game.js        ゲームロジック（物理・当たり判定・スコア・状態遷移）
js/render.js      Canvas 描画
js/main.js        メインループ / 入力 / 画面遷移

manifest.webmanifest / sw.js / icons/   PWA（インストールとオフライン再生）

deploy/serve.py               .webmanifest を正しい MIME で返す静的サーバ
deploy/install-on-pi.sh       ラズパイに systemd 登録して自動起動
deploy/tailscale-setup.sh     Tailscale の HTTPS（*.ts.net）で公開
deploy/nginx-exhilaration.conf / exhilaration.service
.github/workflows/pages.yml   GitHub Pages への自動デプロイ
```

外部依存ゼロ、ビルド不要、全部バニラ JS + Canvas 2D です。


---

# 📱 スマホに入れる（ストア不要）

このゲームは **PWA**（Progressive Web App）です。ブラウザで開いて「ホーム画面に追加」すると、
アイコンが並び、アドレスバーなしの全画面で起動し、**機内モードでも遊べます**。
App Store / Google Play への申請も、開発者登録も不要です。

> **前提**: インストールできるのは **https:// で配信されている場合**（`localhost` は例外）。
> GitHub Pages を使うのが一番早いです。ラズパイの `http://192.168.x.x` 直アクセスでも
> **iPhone はホーム画面追加まで可能**ですが、Android のインストールとオフライン動作には
> HTTPS が要ります。Tailscale を使っているなら
> [`*.ts.net` で HTTPS 公開](#-ラズパイで動かす)するのが一番ラクです。

## iPhone / iPad（Safari）

1. **Safari** でゲームの URL を開く（Chrome アプリからは追加できません）
2. 下部の **共有ボタン** <kbd>⬆︎</kbd> をタップ
3. **「ホーム画面に追加」** → 右上の **追加**
4. ホーム画面のアイコンから起動 → 全画面で始まります

- **音が鳴らないとき**: 本体側面の **サイレントスイッチを解除**してください。
  （iOS は消音中に WebAudio が鳴らないため、無音の `<audio>` を鳴らして回避する処理を
  `js/audio.js` に入れてありますが、機種によっては効かないことがあります）
- iOS は画面の**バイブレーションに非対応**です（Android では振動します）
- 横向き推奨。縦持ちだと「横向きにしてください」と案内が出ます

## Android（Chrome / Edge）

1. Chrome で URL を開く
2. タイトル画面の **「📲 ホーム画面にアプリとして追加」** ボタンを押す
   （出ない場合は右上メニュー → **「アプリをインストール」** / 「ホーム画面に追加」）
3. ホーム画面のアイコンから起動 → 全画面・横向き固定で始まります

Android は割る／爆発／ジャストガード／BURST のタイミングで**端末が振動**します（消音 `M` で一緒に切れます）。

## スマホでの操作

| 操作 | やり方 |
|---|---|
| パドル移動 | 画面をドラッグ |
| 発射 | タップ |
| ジャストガード | 画面左下の **GUARD** ボタン（ガチモードのみ表示） |
| BURST | 画面右下の **BURST** ボタン（ガチモードのみ。おきらくは自動発動） |

横長の端末では GUARD / BURST は**画面両端の黒帯**に置かれるので、盤面を隠しません。
描画が重い端末では、フレームレートを見て粒子の量を自動的に落とします。

## どうしても「本物のアプリ（APK / IPA）」にしたい場合

PWA で困らないはずですが、参考まで:

- **Android (APK)**: [PWABuilder](https://www.pwabuilder.com/) に公開 URL を入れると、
  この PWA を包んだ署名済み APK を生成できます。端末の「提供元不明のアプリ」を許可して
  サイドロードすればストア無しで配布可能です
- **iPhone (IPA)**: 無料枠だと Xcode + AltStore などで 7 日ごとの再署名が必要になり、かなり面倒です。
  **PWA を強く推奨します**

---

# 🌐 GitHub Pages で公開する

`.github/workflows/pages.yml` を同梱してあるので、**設定を1回変えるだけ**で自動デプロイされます。

1. GitHub のリポジトリ → **Settings** → **Pages**
2. **Source** を **「GitHub Actions」** に変更
3. このブランチに push すると Actions が走り、数十秒で公開されます

公開 URL:

```
https://masashi-bayman.github.io/exhilaration-game/
```

- HTTPS なので **Android のインストールもオフライン動作もフルで効きます**
- URL をそのままスマホに送れば、そこから「ホーム画面に追加」できます
- ワークフローは `main` / `master` / `claude/**` への push で動きます

---

# 🍓 ラズパイで動かす

同じ Wi-Fi の中で、家族や友達のスマホからも遊べるようにします。Pi Zero 2 W でも十分動きます
（描画はブラウザ側なので、ラズパイはファイルを配るだけ）。

## 置き場所はどこでもいい

`install-on-pi.sh` はスクリプト自身の位置からリポジトリの場所を割り出して
systemd ユニットを書くので、**clone 先はどこでも構いません**（`~/exhilaration-game` でも
`/opt/games/exhilaration` でも `/srv/...` でも動きます）。気をつけるのは3点だけ:

- **起動ユーザが読めること** — スクリプトを実行したユーザでそのまま動きます
- **起動時にマウントされている場所であること** — `/etc/fstab` に書いていない外付け USB に
  置くと、再起動後にサービスが起動できません
- **nginx を使う場合だけ** `www-data` が読める場所（`/var/www/...` が無難）

## 一番かんたん（Python の常駐サーバ）

```bash
sudo apt update && sudo apt install -y git python3
git clone https://github.com/masashi-bayman/exhilaration-game.git ~/exhilaration-game
cd ~/exhilaration-game
bash deploy/install-on-pi.sh          # systemd に登録して自動起動まで
```

終わると LAN の URL が表示されます:

```
http://192.168.x.x:8080/
```

| コマンド | 用途 |
|---|---|
| `sudo systemctl status exhilaration` | 状態確認 |
| `sudo systemctl restart exhilaration` | 再起動 |
| `sudo systemctl stop exhilaration` | 停止 |
| `cd ~/exhilaration-game && git pull && sudo systemctl restart exhilaration` | 更新 |

ポートを変えたいときは `PORT=9000 bash deploy/install-on-pi.sh`。

## nginx で配信する場合

```bash
sudo apt install -y nginx
sudo mkdir -p /var/www/exhilaration
sudo cp -r ~/exhilaration-game/{index.html,css,js,icons,manifest.webmanifest,sw.js} /var/www/exhilaration/
sudo cp ~/exhilaration-game/deploy/nginx-exhilaration.conf /etc/nginx/sites-available/exhilaration
sudo ln -sf /etc/nginx/sites-available/exhilaration /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

`deploy/nginx-exhilaration.conf` には PWA に必要な設定を入れてあります:
`.webmanifest` の MIME 指定、`sw.js` のキャッシュ無効化、gzip。

## 名前でアクセスしたい

ラズパイの mDNS（avahi）が有効なら `http://raspberrypi.local:8080/` で届きます。
`sudo raspi-config` でホスト名を `exhilaration` にすれば `http://exhilaration.local:8080/`。

## Tailscale の `*.ts.net` で HTTPS 公開する（おすすめ）

すでに Tailscale を使っているなら、これが一番ラクで一番いい方法です。
`https://<マシン名>.<tailnet名>.ts.net/` という**本物の証明書つき HTTPS** が手に入るので、
Android の PWA インストールもオフライン再生もフルに効きますし、外出先からも遊べます。
証明書の更新も Tailscale 任せです。

### 1回だけ管理画面で設定

[login.tailscale.com/admin/dns](https://login.tailscale.com/admin/dns) を開いて:

- **MagicDNS** を有効化
- **HTTPS Certificates** を **Enable**

### ラズパイ側

```bash
cd ~/exhilaration-game
bash deploy/install-on-pi.sh        # まだならゲームのサーバを常駐させる
bash deploy/tailscale-setup.sh      # Tailscale の HTTPS を前に立てる
```

中でやっているのはこれだけです:

```bash
sudo tailscale serve --bg --https=443 http://localhost:8080
```

終わると遊べる URL が表示されます:

```
https://raspberrypi.tailXXXXXX.ts.net/
```

| やりたいこと | コマンド |
|---|---|
| 状態を見る | `tailscale serve status` |
| 公開をやめる | `bash deploy/tailscale-setup.sh --off` |
| ポートを変える | `PORT=9000 bash deploy/tailscale-setup.sh` |
| 誰にでも見せる | `bash deploy/tailscale-setup.sh --funnel` |

- `--bg` で入れているので、**ラズパイを再起動しても勝手に復帰**します
- **tailnet 内限定**です。スマホ側にも Tailscale アプリを入れて同じアカウントで
  ログインしてください。それだけで自宅でも外出先でも同じ URL で遊べます
- Tailscale を入れていない人（友達など）にも見せたいときは `--funnel` を付けると
  インターネットに公開されます（管理画面で Funnel の許可が必要）。
  URL を知っていれば誰でも遊べる状態になる点だけ注意してください

> **注意**: PWA のインストールは **URL（オリジン）ごと**に別物として扱われます。
> 先に `http://192.168.x.x:8080` でホーム画面に追加していた場合、`ts.net` の URL で
> 入れ直すと別アプリ扱いになり、**ベストスコアは引き継がれません**（`localStorage` が別）。
> どの URL で遊ぶか決めてから入れるのがおすすめです。

## その他の HTTPS 化の手段

LAN の `http://` のままでも **遊べますし、iPhone ならホーム画面にも追加できます**。
Tailscale を使わない場合は:

1. **Cloudflare Tunnel** — `cloudflared tunnel` でドメイン付き HTTPS を無料で生やせます
2. **GitHub Pages** — ラズパイを使わず、そもそも HTTPS で配る（この README の上の方）
3. **自己署名証明書** — スマホ側に証明書をインストールする必要があり、iOS はかなり面倒なので非推奨

---

# 🔄 更新したときの注意

Service Worker がファイルをキャッシュしているため、**中身を書き換えたら `sw.js` の版数を上げてください**。

```js
var CACHE = 'exhilaration-v1';   // → 'exhilaration-v2' に変える
```

上げ忘れると、インストール済みの端末に古い版が出続けます。
（開発中は DevTools → Application → Service Workers の "Update on reload" が便利です）

---

# 🛠 動作確認について

Playwright + Chromium で以下を実機相当で確認済みです:

- タイトル → 2モード → ウェーブ進行 → クリア → ポーズ → ゲームオーバー → リトライの全遷移
- レベルアップの3択（全20種が抽選に乗ること、モード専用の出し分け、引き直し、
  取り切ったときの保険カード）と、怪力・安全ネット・皿レーダーなど個別効果の発動
- ジャストガードの成立、BURST でのボール増殖（44個到達）、爆発皿の連鎖
- Service Worker の登録とオフライン起動、マニフェストの MIME / アイコン読み込み
- iPhone 13 相当（844×390）でのタッチ操作・ボタン配置、縦持ち時の回転案内
- 最も重い場面（ボール44個＋破片400個）で 50〜61fps
