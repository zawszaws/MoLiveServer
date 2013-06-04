var codemirror = (function() {

  var codemirror = {};
  var socket;
  var htmlCodeMirror;
  var jsCodeMirror;

  codemirror.setSocket = function(s) {
    socket = s;
  };

  codemirror.initHtmlCodeMirror = function() {
    htmlCodeMirror = CodeMirror.fromTextArea(document.getElementById('cmHtml'), {
      // theme: 'ambiance',
      lineNumbers: true,
      tabSize: 2,
      mode: 'text/html',
      matchBrackets: true,
      autoCloseBrackets: true,
      // mode: 'xml',
      // htmlMode: true,
      extraKeys: {'Ctrl-Space': 'autocompleteHtml'},
      autoCloseTags: true,
      highlightSelectionMatches: true,
      // styleActiveLine: true,
      lineWrapping: true,
      placeholder: 'HTML Code goes here...\n\nYou can start coding HTML in this area.\nLogin to GitHub to get a list of you gists.\nIf you want to save a file,\neither choose new file and start coding,\nor just start coding and save the code later.',

      // onKeyEvent: function(cm, s){ 
      //   if (s.type == 'keyup') { 
      //     passAndHintHtml(cm); 
      //   } 
      // }, 

      lineNumberFormatter: function(number) {
        // return number === 1 ? '•' : number;
        return number;
      }
    });

    function passAndHintHtml(cm) {
      setTimeout(function() {cm.execCommand('autocompleteHtml');}, 100);
      return CodeMirror.Pass;
    }

    htmlCodeMirror.setSize('100%', '100%');
    htmlCodeMirror.on('cursorActivity', function(cm) {
      var cur = htmlCodeMirror.getCursor();
      var index = htmlCodeMirror.indexFromPos(cur);
      $('#cursorPosIndicator').html('col: ' + cur.ch + ', index: ' + index);
    });
    onChange(htmlCodeMirror, 'html', '#htmlToggleButton');
    CodeMirror.commands.autocompleteHtml = function(cm) {
      CodeMirror.showHint(cm, CodeMirror.htmlHint);
    };

    codemirror.htmlCodeMirror = htmlCodeMirror;
    return htmlCodeMirror;

  }; // codemirrors.initHtmlCm

  codemirror.initJSCodeMirror = function() {
    jsCodeMirror = CodeMirror.fromTextArea(document.getElementById('cmJS'), {
      // theme: 'ambiance',
      lineNumbers: true,
      matchBrackets: true,
      tabSize: 2,
      mode: 'javascript',
      // styleActiveLine: true,
      lineWrapping: true,
      autoCloseBrackets: true,
      highlightSelectionMatches: true,
      extraKeys: {'Ctrl-Space': 'autocompleteJS'},
      gutters: ["CodeMirror-lint-markers"],
      lintWith: CodeMirror.javascriptValidator,
      placeholder: 'JavaScript Code goes here...\n\nYou can start coding JavaScript in this area.\nLogin to GitHub to get a list of you gists.\nIf you want to save a file,\neither choose new file and start coding,\nor just start coding and save the code later.',

      // This, togheter with passAndHint, will trigger autocomplete at each keyup
      // onKeyEvent: function(cm, s){
      //   if (s.type == 'keyup') {
      //     passAndHintJS(cm);
      //   }
      // },

      lineNumberFormatter: function(number) {
        // return number === 1 ? '•' : number;
        return number;
      }
    });

    function passAndHintJS(cm) {
      setTimeout(function() {cm.execCommand('autocompleteJS');}, 100);
      return CodeMirror.Pass;
    }

    jsCodeMirror.setSize('100%', '100%');
    jsCodeMirror.on('cursorActivity', function(cm) {
      $('#runMenu').css('display','none');
      var cur = jsCodeMirror.getCursor();
      var index = jsCodeMirror.indexFromPos(cur);
      $('#cursorPosIndicator').html('col: ' + cur.ch + ', index: ' + index);

      // Enable or disable the run button after linting JavaScript
      JSHINT(jsCodeMirror.getValue());
      var errors = JSHINT.data().errors;
      if (errors) {
        $('#executecode').addClass('disabled');
      } else {
        $('#executecode').removeClass('disabled');
      }
    });
    onChange(jsCodeMirror, 'javascript', '#jsToggleButton');
    onCursorActivity(jsCodeMirror);
    CodeMirror.commands.autocompleteJS = function(cm) {
      CodeMirror.showHint(cm, CodeMirror.javascriptHint);
    };

    codemirror.jsCodeMirror = jsCodeMirror;
    return jsCodeMirror;

  }; // codemirrors.initJsCm

  /**
   * Define onChange for each editor
   */
  function onChange(cm, codeType, toggleButtonName) {
    cm.on('change', function(editor, change) {

      if ($('#autoload').is(':checked')) {

        JSHINT(jsCodeMirror.getValue());
        var errors = JSHINT.data().errors;

        if (codeType == 'html') {
          emitCode(codeType, editor, true);
          if(typeof(errors) == 'undefined') {
            emitCode('javascript', jsCodeMirror, true);
          }
        }

        if (codeType == 'javascript') {
          // why do we need to run html if only JavaScript code is changed?
          // emitCode('html', htmlCodeMirror);
          if(typeof(errors) == 'undefined') {
            emitCode(codeType, editor, false);
          }
        }

      }

      if($('#gistsToggleLink').attr('href') != 'choose') {
        $('#savecode').removeClass('disabled').removeClass('btn-info');
      }

      codeType = codeType == 'html' ? 'HTML files ' : 'JS files ';

      // Change color of save button to give feedback of a modified file
      if( !$('#savecode').hasClass('disabled') &&
          !$('#savecode').hasClass('btn-info') &&
          $(toggleButtonName).text() != codeType + 'files ' &&
          (change.origin == '+input' || change.origin == '+delete' || change.origin == 'undo')) {
        $('#savecode').addClass('btn-info');
      }
    });
  }

  //-------------------------------------------------------
  //
  // Acorn
  // Rules: 1. If node is a program get the last statement/node
  //        2. If node is a literal get the node around by passing
  //           the (start of the literal node - 1) to find the VariableDeclaration
  //        3. If node is a block, find the function declaration
  //           togheter with the body. PROBLEM: when changing a 
  //           function declaration we should execute all the calls
  //           to that function!
  //           
  //
  // Depending on where we are with the cursor we want to extract the
  // surrounding statement to executing it, a la Smalltalk. Also, add
  // a feature so that the user can select e portion of the text and
  // execute it.
  function onCursorActivity(cm) {
    cm.on('cursorActivity', function(cm) {
      if ($('#autoload').is(':checked')) {
        updateParserHighlightWithLatency();
      }
    });
  }

  var latencyFromLastCursorActivity = 100;
  function updateParserHighlightWithLatency() {
    lastCursorActivity = new Date().getTime();
    setTimeout(function() {
      var currentTime = new Date().getTime();
      if (currentTime - lastCursorActivity > latencyFromLastCursorActivity) {
        highlightFirstLevelActiveNode();
      }
    }, latencyFromLastCursorActivity + 10);
  }

  function highlightFirstLevelActiveNode() {
    if (typeof(marker) != 'undefined') marker.clear();
    var node = firstLevelActiveNode();
    if (typeof(node) != 'undefined') {
      var start = node.start;
      var end = node.end;
      marker = jsCodeMirror.markText(start, end, {className: 'parserHighlight'});
    }
  }

  function firstLevelActiveNode() {
    var code = jsCodeMirror.getValue();

    // If there is an error, stop parsing
    JSHINT(code);
    var errors = JSHINT.data().errors;
    if (errors) return;

    // parse the program to a node program
    var program = acorn.parse(code, {locations: true, ranges: true});

    // get the position of the cursor, specified as index(int) of
    // the total characters from start to caret (and not as {line,ch})
    var pos = jsCodeMirror.indexFromPos(jsCodeMirror.getCursor());
    for (var i = 0; i < program.body.length; i++) {
      var startIndexNode = program.body[i].start;
      var endIndexNode = program.body[i].end;

      if(program.body[i].type == 'VariableDeclaration') {
        endIndexNode++;
      }

      var startNode = jsCodeMirror.posFromIndex(startIndexNode);
      var endNode = jsCodeMirror.posFromIndex(endIndexNode);

      if (pos >= startIndexNode && pos <= endIndexNode) {
        return {
          start: startNode,
          end: endNode,
          content: jsCodeMirror.getRange(startNode, endNode)
        };
      }
    }
  }

  /**
   * Emit code through the socket.
   * This function is bound to any change made to the code editors.
   */
  var latencyFromLastPress = 100;
  function emitCode(codeType, editor, executeEverything) {
    lastKeypress = new Date().getTime();
    setTimeout(function() {
      var currentTime = new Date().getTime();
      if (currentTime - lastKeypress > latencyFromLastPress) {
        if (codeType == 'javascript' && !executeEverything) {
          console.log('is js and live');
          var node = firstLevelActiveNode();
          if (typeof(node) != 'undefined') {
            socket.emit(codeType, node.content);
          }
        } else {
          console.log('is not live');
          socket.emit(codeType, editor.getValue());
        }
      }
    }, latencyFromLastPress + 10);
  }

  return codemirror;

})(); // end file