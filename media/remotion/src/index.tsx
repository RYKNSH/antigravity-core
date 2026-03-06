import { Composition } from 'remotion';
import { Hook } from './templates/hook/Hook';
import { Proof } from './templates/proof/Proof';
import { Demo } from './templates/demo/Demo';
import { OpEd } from './templates/op-ed/OpEd';

export const RemotionRoot: React.FC = () => {
    return (
        <>
        {/* フック型広告 — 30fps, 3秒 */ }
        < Composition
        id = "Hook"
    component = { Hook }
    durationInFrames = { 90}
    fps = { 30}
    width = { 1080}
    height = { 1920}
    defaultProps = {{ title: 'タイトル', subtitle: 'サブタイトル' }
}
      />
{/* 実績・証拠型 — 30fps, 15秒 */ }
<Composition
        id="Proof"
component = { Proof }
durationInFrames = { 450}
fps = { 30}
width = { 1080}
height = { 1920}
defaultProps = {{ headline: '実績', stats: [], testimonial: '' }}
      />
{/* デモ・説明型 — 30fps, 30秒 */ }
<Composition
        id="Demo"
component = { Demo }
durationInFrames = { 900}
fps = { 30}
width = { 1080}
height = { 1920}
defaultProps = {{ title: 'デモ', steps: [] }}
      />
{/* OP/ED ブランドアニメーション — 30fps, 5秒 */ }
<Composition
        id="OpEd"
component = { OpEd }
durationInFrames = { 150}
fps = { 30}
width = { 1080}
height = { 1920}
defaultProps = {{ logoText: 'ANTIGRAVITY', tagline: 'Power to the People' }}
      />
    </>
  );
};
