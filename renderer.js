const { ipcRenderer } = require("electron");
const { Terminal } = require("xterm");
const { FitAddon } = require("xterm-addon-fit");
const $ = require("jquery");
require("jstree");
const path = require("path");
const fs = require("fs");

//ターミナルの初期化
const terminal = new Terminal();
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);

//ターミナルをDOM要素に追加
const terminalContainer = document.getElementById("terminal");
terminal.open(terminalContainer);
fitAddon.fit();

//入力を保持するための変数
let inputBuffer = "";
let stage = "host";
let host, username, password;

//初期プロンプトの表示
terminal.write("SSH接続を開始します\r\n");
terminal.write("ホスト名: ");

//ターミナルで入力したコマンドを送信
terminal.onData(async (data) => {
  if (data === "\r") {
    if (stage === "host") {
      host = inputBuffer;
      inputBuffer = "";
      terminal.write("\r\nホスト名: " + host + "\r\n");
      terminal.write("ユーザ名: ");
      stage = "username";
    } else if (stage === "username") {
      username = inputBuffer;
      inputBuffer = "";
      terminal.write("\r\nユーザ名: " + username + "\r\n");
      terminal.write("パスワード: ");
      stage = "password";
    } else if (stage === "password") {
      password = inputBuffer;
      inputBuffer = "";
      terminal.write("\r\nパスワード: ***********\r\n");
      terminal.write("接続中...\r\n");

      //SSH接続を開始
      const result = await ipcRenderer.invoke("ssh-connect", {
        host,
        username,
        password,
      });

      if (result === "connected") {
        terminal.write("\r\n接続しました\r\n");
        terminal.write(">");
        stage = "command";
      } else {
        terminal.write("\r\n接続に失敗しました\r\n");
        stage = "host";
      }
    } else if (stage === "command") {
      //シェルコマンドの実行
      ipcRenderer.invoke("ssh-exec", inputBuffer);
      terminal.write("\r\n> ");
      inputBuffer = "";
    }
  } else if (data === "\u007f") {
    //バックスペース
    //バックスペースの処理
    inputBuffer = inputBuffer.slice(0, -1); //最後の文字を削除
    terminal.write("\b \b"); //ターミナルに表示
  } else {
    inputBuffer += data; //入力をバッファに追加
    terminal.write(data); //ターミナルに表示
  }
});

//シェルの出力を受け取りターミナルに表示
ipcRenderer.on("shell-output", (event, output) => {
  terminal.write(output);
});

// new-fileイベントをリスンしてエディタをリセット
ipcRenderer.on("new-file", () => {
  editor.setValue("");
  document.getElementById("filename").textContent = "Untitled";
  currentFilePath = null;
  currentContent = "";
  isContentChanged = false;
});

let currentFilePath = null;
let currentContent = "";
let isContentChanged = false;

var editor = ace.edit("editor");

// ファイルを保存する処理
ipcRenderer.on("save-file", (event, filePath) => {
  const content = editor.getValue();
  ipcRenderer.send("save-file", filePath, content);
  isContentChanged = false;
});

// 名前を付けてファイルを保存する処理
ipcRenderer.on("save-as-file", () => {
  const content = editor.getValue();
  ipcRenderer.send("save-as-file", content);
  isContentChanged = false;
});

// ファイルを開く処理
ipcRenderer.on("open-file", () => {
  ipcRenderer.send("open-dialog");
});

// ファイルが開かれたときの処理
ipcRenderer.on("file-opened", (event, data, filePath) => {
  console.log("File Content:", data); // デバッグ用に追加
  editor.setValue(data);
  currentFilePath = filePath;
  currentContent = data;
  isContentChanged = false;
  document.getElementById("filename").textContent = filePath;
});

// ファイルが保存されたときの処理
ipcRenderer.on("file-saved", (event, filePath) => {
  currentFilePath = filePath;
  currentContent = editor.getValue();
  isContentChanged = false;
  document.getElementById("filename").textContent = filePath;
});

//ファイルを読み込む処理
ipcRenderer.on("file-read", (event, content) => {
  editor.setValue(content);
  currentContent = content;
  isContentChanged = false;
});

// フォルダを開く処理
ipcRenderer.on("open-folder", () => {
  ipcRenderer.send("open-folder-dialog");
});

//エディタの中身が変更されたときにisContentChangedをtrueにする
ipcRenderer.on("content-changed", (event, changed) => {
  isContentChanged = changed;
});

//directory-treeを受け取りフォルダ構造を表示
ipcRenderer.on("directory-tree", (event, tree) => {
  refreshTree(tree);
});

const openFile = (filePath) => {
  ipcRenderer.send("read-file", filePath);
};

ipcRenderer.on("file-opened", (event, data, filePath) => {
  editor.setValue(data);
  currentFilePath = filePath;
  currentContent = data;
  isContentChanged = false;
  document.getElementById("filename").textContent = filePath;
});

function getFilesRecursively(dir) {
  const files = fs.readdirSync(dir);
  return files.map((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      return {
        text: file,
        children: getFilesRecursively(filePath),
        icon: "jstree-folder",
        filePath: null,
        a_attr: { style: "color: yellow" },
      };
    } else {
      return {
        text: file,
        children: [],
        icon: "jstree-file",
        filePath: filePath,
        a_attr: { style: "color: white" },
      };
    }
  });
}

function refreshTree(tree) {
  console.log("refreshed");
  // ツリーを初期化
  const treeContainer = $("#tree-container").jstree(true);
  if (treeContainer) {
    treeContainer.settings.core.data = tree.map((node) => ({
      text: node.text,
      children: node.children,
      filePath: node.filePath,
      icon: node.icon,
    }));
    treeContainer.refresh(); // ツリーをリフレッシュ
  } else {
    $("#tree-container").jstree({
      core: {
        data: tree.map((node) => ({
          text: node.text,
          children: node.children,
          filePath: node.filePath,
          icon: node.icon,
        })),
      },
    });
  }
}

ipcRenderer.on("refresh-tree", (tree) => {
  refreshTree(tree);
});

document.addEventListener("DOMContentLoaded", () => {
  const refreshButton = document.getElementById("refresh");
  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      console.log("refresh clicked");
      const tree = getFilesRecursively(currentFilePath);
      refreshTree(tree);
    });
  } else {
    console.error("Refresh button not found");
  }

  $("#tree-container").on("select_node.jstree", (e, data) => {
    const filePath = data.node.original.filePath;
    console.log(filePath);
    if (filePath) {
      openFile(filePath);
    }
  });
});
