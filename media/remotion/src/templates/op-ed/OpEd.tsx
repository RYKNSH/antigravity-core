import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import React from 'react';

interface OpEdProps {
    logoText: string;      // ロゴ文字列（例: 'ANTIGRAVITY'）
    tagline?: string;      // キャッチライン（例: 'Power to the People'）
    role: 'op' | 'ed';    // 'op'=オープニング（フェードイン）/ 'ed'=エンディング（フェードアウト）
}

export const OpEd: React.FC<OpEdProps> = ({ logoText, tagline, role }) => {
    const frame = useCurrentFrame();
    const { fps, durationInFrames } = useVideoConfig();

    // ── OP: フェードイン → キープ ──────────────────────────────
    const opLogoOpacity = role === 'op'
        ? interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' })
        : 1;
    const opTaglineOpacity = role === 'op'
        ? interpolate(frame, [35, 55], [0, 1], { extrapolateRight: 'clamp' })
        : 1;

    // ── ED: キープ → フェードアウト ────────────────────────────
    const edFade = role === 'ed'
        ? interpolate(frame, [durationInFrames - 30, durationInFrames - 5], [1, 0], { extrapolateRight: 'clamp' })
        : 1;

    const logoOpacity = opLogoOpacity * edFade;
    const taglineOpacity = opTaglineOpacity * edFade;

    // ロゴスケール（OP: 小→大, ED: そのまま）
    const logoScale = role === 'op'
        ? spring({ frame, fps, from: 0.88, to: 1.0, config: { damping: 16, stiffness: 60 } })
        : 1.0;

    // ── ロゴ文字ごとのストロボ演出（OP時のみ）─────────────────
    const chars = logoText.split('');
    const charDelay = 2; // フレーム/文字

    // アクセントライン幅
    const lineWidth = interpolate(frame, [45, 80], [0, 240], { extrapolateRight: 'clamp' });

    return (
        <AbsoluteFill style={{
            backgroundColor: '#0A0A0A',
            justifyContent: 'center',
            alignItems: 'center',
            fontFamily: '"Noto Sans JP", "Helvetica Neue", sans-serif',
        }}>
            {/* 背景のミニマルグリッド */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'radial-gradient(circle, rgba(192,192,192,0.04) 1px, transparent 1px)',
                backgroundSize: '80px 80px',
                opacity: interpolate(frame, [0, 40], [0, 1], { extrapolateRight: 'clamp' }),
            }} />

            <div style={{ textAlign: 'center', zIndex: 1 }}>
                {/* ロゴ */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 4,
                    transform: `scale(${logoScale})`,
                    marginBottom: 24,
                }}>
                    {chars.map((char, i) => {
                        const charOpacity = role === 'op'
                            ? interpolate(frame, [i * charDelay, i * charDelay + 12], [0, 1], { extrapolateRight: 'clamp' })
                            : 1;
                        return (
                            <span key={i} style={{
                                color: '#FFFFFF',
                                fontSize: 112,
                                fontWeight: 700,
                                letterSpacing: '0.12em',
                                lineHeight: 1,
                                opacity: charOpacity * edFade,
                            }}>
                                {char}
                            </span>
                        );
                    })}
                </div>

                {/* アクセントライン */}
                <div style={{
                    width: lineWidth,
                    height: 1.5,
                    backgroundColor: '#C0C0C0',
                    margin: '0 auto 32px',
                    borderRadius: 1,
                    opacity: edFade,
                }} />

                {/* タグライン */}
                {tagline && (
                    <p style={{
                        color: '#C0C0C0',
                        fontSize: 38,
                        fontWeight: 300,
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        margin: 0,
                        opacity: taglineOpacity,
                    }}>
                        {tagline}
                    </p>
                )}
            </div>
        </AbsoluteFill>
    );
};
