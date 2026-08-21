メル MakeUp AI Ver.3.0 — CHAPI AI MAKEUP STUDIO

追加:
- 「ちゃぴのメイク版」AI画像提案セクション
- 今日の予定・肌・生理周期・好み・手持ちコスメをAI画像プロンプトに統合
- AI完成メイク画像
- AIメイク手順シート画像
- 生成画像を端末内履歴に最大12件保存
- バックエンドURL設定画面
- GitHub Pages側にAPIキーを置かない安全設計

重要:
GitHub Pagesは静的サイトなので、OpenAI等の秘密APIキーをindex.htmlへ直接入れないでください。
実際の画像生成にはサーバー側の小さなバックエンドが必要です。
BACKEND_EXAMPLE.txt にフロント側が期待するレスポンス形式を書いています。

GitHub Pagesへの更新:
index.html を既存リポジトリへ上書きしてください。
