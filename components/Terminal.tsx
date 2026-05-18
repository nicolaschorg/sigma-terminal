'use client';
import TopBar     from './TopBar';
import CommandBar from './CommandBar';
import PanelGrid  from './PanelGrid';

export default function Terminal() {
  return (
    <div style={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: '#080c14',
      overflow: 'hidden',
    }}>
      <TopBar />
      <CommandBar />
      <PanelGrid />
    </div>
  );
}
