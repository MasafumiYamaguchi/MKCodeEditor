const { app, Menu, BrowserWindow, dialog, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')
const { NodeSSH } = require('node-ssh')

const ssh = new NodeSSH();
let win;
let currentFilePath = null // 現在開いているファイルのパスを保持

const createWindow = () => {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
}

const templateMenu = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New File',
        accelerator: 'Ctrl+N',
        click() {
          win = BrowserWindow.getFocusedWindow()
          win.webContents.send('new-file')
          currentFilePath = null // 新しいファイルを作成するときにファイルパスをリセット
        }
      },
      {
        label: 'Save File',
        accelerator: 'Ctrl+S',
        click() {
          win = BrowserWindow.getFocusedWindow()
          win.webContents.send('save-file', currentFilePath)
        }
      },
      {
        label: 'Save as File',
        accelerator: 'Ctrl+Shift+S',
        click() {
          win = BrowserWindow.getFocusedWindow()
          win.webContents.send('save-as-file')
        }
      },
      {
        label: 'Open File',
        accelerator: 'Ctrl+O',
        click() {
          win = BrowserWindow.getFocusedWindow()
          win.webContents.send('open-file')
        }
      },
      {
        label: 'Open Folder',
        accelerator: 'Ctrl+Shift+O',
        click: async () => {
          const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory']
          });

          if (!result.canceled) {
            const dirPath = result.filePaths[0];
            console.log('Selected Folder:', dirPath);
            const tree = getFilesRecursively(dirPath);
            win.webContents.send('directory-tree', tree);
          }
        }
      },
        {
            label: 'Exit',
            role: 'quit'
        }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      {
        label: 'Copy',
        accelerator: 'Ctrl+C',
        click() {
          console.log('Copy')
        }
      },
      {
        label: 'Paste',
        accelerator: 'Ctrl+V',
        click() {
          console.log('Paste')
        }
      }
    ]
  }
]

app.whenReady().then(() => {
  createWindow()

  const menu = Menu.buildFromTemplate(templateMenu)
  Menu.setApplicationMenu(menu)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.on('save-file', (event, currentFilePath, content) => {
  win = BrowserWindow.getFocusedWindow();
    if (currentFilePath) {
      fs.writeFile(currentFilePath, content, (err) => {
        if (err) {
          console.log('File Save Error:', err);
        } else {
          console.log('File Saved Successfully');
          event.sender.send('file-saved', currentFilePath);
        }
      });
    } else {
      dialog.showSaveDialog(win, {
        title: 'Save File',
        defaultPath: 'untitled.txt',
        filters: [
          { name: 'All Files', extensions: ['*'] }
        ]
      }).then(result => {
        if (!result.canceled && result.filePath) {
          fs.writeFile(result.filePath, content, (err) => {
            if (err) {
              console.log('File Save Error:', err);
            } else {
              console.log('File Saved Successfully');
              event.sender.send('file-saved', result.filePath);
            }
          });
        }
      }).catch(err => {
        console.log('Save Dialog Error:', err);
      });
    }
});

ipcMain.on('save-as-file', (event, content) => {
  win = BrowserWindow.getFocusedWindow()
  dialog.showSaveDialog(win, {
    title: 'Save File As',
    defaultPath: 'untitled.txt',
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(result => {
    if (!result.canceled) {
      fs.writeFile(result.filePath, content, (err) => {
        if (err) {
          console.log('File Save Error:', err)
        } else {
          console.log('File Saved Successfully')
          event.sender.send('file-saved', result.filePath)
        }
      })
    }
  }).catch(err => {
    console.log('Save Dialog Error:', err)
  })
})

ipcMain.on('open-dialog', (event) => {
  win = BrowserWindow.getFocusedWindow()
  dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(result => {
    if (!result.canceled) {
      fs.readFile(result.filePaths[0], 'utf-8', (err, data) => {
        if (err) {
          console.log('File Open Error:', err)
        } else {
          currentFilePath = result.filePaths[0]
          event.sender.send('file-opened', data, currentFilePath)
        }
      })
    }
  }).catch(err => {
    console.log('Open Dialog Error:', err)
  })
})


function getFilesRecursively(dir) {
  const files = fs.readdirSync(dir);
  return files.map(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
          return {
              text: file,
              children: getFilesRecursively(filePath),
              icon: 'jstree-folder',
              filePath: null,
          };
      } else {
          return {
              text: file,
              children: [],
              icon: 'jstree-file',
              filePath: filePath,
          };
      }
  });
}

ipcMain.on('open-folder-dialog', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (!result.canceled) {
    const dirPath = result.filePaths[0];
    const tree = getFilesRecursively(dirPath);
    console.log("filePath", dirPath);
    event.sender.send('directory-tree', tree);
  }
});

ipcMain.handle('open-folder-dialog', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('get-directory-tree', async (event, dirPath) => {
  if (dirPath) {
    const tree = getFilesRecursively(dirPath);
    return tree;
  }
  return [];
});

ipcMain.on('read-file', (event, filePath) => {
  fs.readFile(filePath, 'utf-8', (err, data) => {
    currentFilePath = filePath;
    if (err) {
      console.error('File read error:', err);
      return;
    }
    event.sender.send('file-opened', data, filePath);
  });
});

//SSHクライアントの処理

ipcMain.handle('ssh-connect', async (event, { host, username, password} ) => {
  try {
    await ssh.connect({
      host,
      username,
      password,
    });

    //シェルを開始
    channel = await ssh.requestShell();
    channel.on('data', (data) => {
      win.webContents.send('shell-output', data.toString());
    });

    //接続成功のメッセージ
    return 'connected';
  } catch (err) {
    console.error('SSH Connection Error:', err);
    return 'failed';
  }
});

//コマンドの実行
ipcMain.handle('ssh-exec', (event, command) => {
  if (channel) {
    channel.write(command + '\n');
  }
});