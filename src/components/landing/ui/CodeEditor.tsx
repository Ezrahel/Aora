// CodeMirror 6 with a palette driven by the --lp-* tokens, so it follows the theme.
// Default export so it can be lazy-loaded: the editor stays out of the first paint.
import { useEffect, useRef } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, bracketMatching, syntaxHighlighting } from "@codemirror/language";
import { json } from "@codemirror/lang-json";
import { javascript } from "@codemirror/lang-javascript";
import { tags } from "@lezer/highlight";

const chrome = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "var(--lp-text)", fontSize: "13px", height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.7", overflow: "auto" },
  ".cm-content": { caretColor: "var(--lp-text)", padding: "12px 0" },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--lp-muted)", border: "none", paddingLeft: "6px" },
  ".cm-activeLine": { backgroundColor: "var(--lp-surface)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--lp-text)" },
  ".cm-cursor": { borderLeftColor: "var(--lp-text)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection": { backgroundColor: "var(--lp-hover) !important" },
  ".cm-matchingBracket": { backgroundColor: "var(--lp-hover)", color: "var(--lp-text)" },
});

const palette = HighlightStyle.define([
  { tag: [tags.propertyName, tags.definition(tags.variableName)], color: "var(--lp-code-key)" },
  { tag: [tags.string], color: "var(--lp-code-string)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--lp-code-number)", fontWeight: "600" },
  { tag: [tags.keyword, tags.operatorKeyword], color: "var(--lp-code-comment)" },
  { tag: [tags.comment], color: "var(--lp-code-comment)", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--lp-code-key)", fontWeight: "600" },
  { tag: [tags.punctuation, tags.bracket, tags.separator], color: "var(--lp-muted)" },
]);

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: "json" | "javascript";
  readOnly?: boolean;
  label: string;
}

export default function CodeEditor({ value, onChange, language, readOnly = false, label }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const extensions: Extension[] = [
      chrome,
      syntaxHighlighting(palette),
      language === "json" ? json() : javascript(),
      EditorView.contentAttributes.of({ "aria-label": label }),
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
    ];
    if (!readOnly) {
      extensions.push(
        lineNumbers(),
        history(),
        bracketMatching(),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) change.current?.(update.state.doc.toString());
        }),
      );
    }
    const editor = new EditorView({ parent: host.current, state: EditorState.create({ doc: value, extensions }) });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor is built once per mode; value changes are applied below.
  }, [language, readOnly, label]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={host} className="h-full min-h-0" />;
}
