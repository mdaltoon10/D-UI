import type { ReactNode } from 'react';
import { Tooltip } from 'antd';

/* Builds a settings category tab label: icon only with tooltip, compact and orderly */
export function catTabLabel(icon: ReactNode, text: ReactNode, _iconsOnly?: boolean): ReactNode {
  return (
    <Tooltip title={text} placement="top" arrow={{ pointAtCenter: true }}>
      <span className="cat-tab-icon-wrapper" aria-label={typeof text === 'string' ? text : undefined}>
        {icon}
      </span>
    </Tooltip>
  );
}


