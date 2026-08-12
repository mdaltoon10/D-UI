import type { MobileCodeAceEditorProps } from '@/pg-ui/components/common/mobile-code-ace-editor'
import MobileCodeAceEditor from '@/pg-ui/components/common/mobile-code-ace-editor'

/** @deprecated Prefer {@link MobileCodeAceEditor} with `language="yaml"`. */
export default function MobileYamlAceEditor(props: Omit<MobileCodeAceEditorProps, 'language' | 'aceMode'>) {
  return <MobileCodeAceEditor {...props} language="yaml" />
}
