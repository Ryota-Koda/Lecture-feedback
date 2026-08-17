# 教員用・学生用画面の変更を反映する方法

この変更は現在の`main`を基準に作成しています。主に`frontend/`を更新し、LambdaコードやAWSリソースは変更しません。

## 方法1：パッチを適用する（推奨）

反映用パッチを、リポジトリと同じ親フォルダへ置いた例です。

```bash
git clone REPOSITORY_URL
cd Lecture-feedback
git switch main
git pull origin main
git switch -c feature/student-teacher-ui
git apply ../Lecture-feedback-student-teacher.patch
```

変更内容を確認します。

```bash
git status
git diff --check
python3 -m unittest discover -s tests -v
```

問題がなければGitHubへ送ります。

```bash
git add .
git commit -m "feat: separate teacher and student quiz screens"
git push -u origin feature/student-teacher-ui
```

GitHubでPull Requestを作成し、内容を確認して`main`へマージします。AmplifyのGitHub連携が有効なら、マージ後に自動デプロイが開始されます。

## 方法2：ZIPの内容をコピーする

1. 反映用ZIPを展開する。
2. GitHubから現在のリポジトリをcloneする。
3. 展開したZIPの内容をclone先へ上書きコピーする。
4. GitHub DesktopまたはGitコマンドで差分を確認する。
5. 作業ブランチへcommit・pushし、Pull Requestを作成する。

ZIP自体をGitHubへアップロードしても自動展開されません。必ず展開したファイルをリポジトリへコピーしてください。

## GitHub Desktopを使う場合

1. GitHub Desktopで対象リポジトリをcloneする。
2. `Current branch`から`New branch`を選び、`feature/student-teacher-ui`を作成する。
3. ZIPを展開し、中身をcloneしたフォルダへ上書きコピーする。
4. GitHub Desktopで変更ファイルを確認する。
5. Summaryへ`feat: separate teacher and student quiz screens`と入力してcommitする。
6. `Publish branch`を押す。
7. GitHub上でPull Requestを作成して`main`へマージする。

## 反映される主なファイル

```text
.gitignore
README.md
docs/APPLY_CHANGES.md
docs/UI_GUIDE.md
docs/ARCHITECTURE.md
docs/DEPLOY_AMPLIFY.md
docs/TEAM_INTEGRATION.md
frontend/index.html
frontend/teacher.html
frontend/student.html
frontend/css/style.css
frontend/js/config.js
frontend/js/api.js
frontend/js/teacher.js
frontend/js/student.js
tests/test_frontend_structure.py
```

## Amplifyデプロイ後の確認

1. Amplifyのビルドが成功している。
2. `/index.html`に教員用・学生用の選択肢が表示される。
3. `/teacher.html`でテキストから小テストを生成できる。
4. 生成された学生用URLをコピーできる。
5. 学生用URLを開くと対象クイズが自動読込される。
6. 回答送信後に点数、正解、解説が表示される。
7. 教員画面で回答結果とAI分析を取得できる。

フロントエンドのURLが同じAmplifyドメインのままなら、通常はCORS設定を変更する必要はありません。

## 元に戻す場合

Pull Requestをマージする前なら、作業ブランチを削除すれば`main`には影響しません。マージ後は、GitHub上で対象Pull RequestをRevertする方法が分かりやすいです。
