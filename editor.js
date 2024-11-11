var editor = ace.edit("editor");
editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/c_cpp");
editor.setFontSize(14);

// エディタのカーソル位置を監視して行数と列数を表示
editor.session.selection.on('changeCursor', () => {
    const position = editor.getCursorPosition();
    document.getElementById('line-number').textContent = position.row + 1;
    document.getElementById('column-number').textContent = position.column + 1;
});