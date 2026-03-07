import { Composition, registerRoot } from 'remotion';
import React from 'react';
import { Hook } from './templates/hook/Hook';
import { Proof } from './templates/proof/Proof';
import { Demo } from './templates/demo/Demo';
import { OpEd } from './templates/op-ed/OpEd';

// SOLOPROブランド仕様 — final_report.md 確定値 → v9.0コピー反映済み
// サイズ: 1080×1920（縦型SNS広告）+ 1080×1080（正方形）
// カラー: 背景 #0A0A0A / テキスト #FFFFFF / アクセント #C0C0C0
// フォント: Noto Sans JP Bold（見出し）/ Regular（本文）

export const RemotionRoot: React.FC = () => {
      return (
            <>
                  {/* Hook型: 3〜5秒の強烈な問いかけ（v9.0 One-liner） */}
                  <Composition
                        id="hook"
                        component={Hook as React.ComponentType}
                        durationInFrames={150}   // 5秒 @ 30fps
                        fps={30}
                        width={1080}
                        height={1920}
                        defaultProps={{
                              eyebrow: '苦手なことは、やらなくていい。',
                              title: '全部やってくれる\nAIエージェント、\nここにいます。',
                              subtitle: 'RYKNSH CORE',
                              cta: '全部無料であげます',
                        }}
                  />

                  {/* Hook型: 正方形バリエーション */}
                  <Composition
                        id="hook-square"
                        component={Hook as React.ComponentType}
                        durationInFrames={150}
                        fps={30}
                        width={1080}
                        height={1080}
                        defaultProps={{
                              eyebrow: '苦手なことは、やらなくていい。',
                              title: '全部やってくれる\nAIエージェント、\nここにいます。',
                              subtitle: 'RYKNSH CORE',
                              cta: '全部無料であげます',
                        }}
                  />

                  {/* Proof型: 実績・社会的証明（v9.0 証言） */}
                  <Composition
                        id="proof"
                        component={Proof as React.ComponentType}
                        durationInFrames={240}   // 8秒 @ 30fps
                        fps={30}
                        width={1080}
                        height={1920}
                        defaultProps={{
                              headline: 'LP 45秒。\n広告動画 1分。\n外注費 ¥0。',
                              stats: [
                                    { value: '45', unit: '秒', label: 'LP草案' },
                                    { value: '1', unit: '分', label: '広告動画' },
                                    { value: '¥0', unit: '', label: '外注費' },
                              ],
                              testimonial: '"ガチプロレベルの広告が出てきた瞬間、\nプロに頼んだんだっけと思いました"',
                              source: '— M.K. コーチ',
                        }}
                  />

                  {/* Proof型: 正方形バリエーション */}
                  <Composition
                        id="proof-square"
                        component={Proof as React.ComponentType}
                        durationInFrames={240}
                        fps={30}
                        width={1080}
                        height={1080}
                        defaultProps={{
                              headline: 'LP 45秒。\n広告動画 1分。\n外注費 ¥0。',
                              stats: [
                                    { value: '45', unit: '秒', label: 'LP草案' },
                                    { value: '1', unit: '分', label: '広告動画' },
                                    { value: '¥0', unit: '', label: '外注費' },
                              ],
                              testimonial: '"ガチプロレベルの広告が出てきた瞬間、\nプロに頼んだんだっけと思いました"',
                              source: '— M.K. コーチ',
                        }}
                  />

                  {/* Demo型: ステップ・使い方説明（v9.0 フロー） */}
                  <Composition
                        id="demo"
                        component={Demo as React.ComponentType}
                        durationInFrames={270}   // 9秒 @ 30fps
                        fps={30}
                        width={1080}
                        height={1920}
                        defaultProps={{
                              title: 'RYKNSH Core を\n受け取る流れ',
                              steps: [
                                    { number: '01', label: 'RYKNSH Core を受け取る', description: '完全無料・永久' },
                                    { number: '02', label: '実演ウェビナーで使い方を学ぶ', description: '90分・無料' },
                                    { number: '03', label: '得意なことだけやる', description: '苦手なことは全部やってもらう' },
                              ],
                              cta: '全部無料であげます',
                        }}
                  />

                  {/* Demo型: 正方形バリエーション */}
                  <Composition
                        id="demo-square"
                        component={Demo as React.ComponentType}
                        durationInFrames={270}
                        fps={30}
                        width={1080}
                        height={1080}
                        defaultProps={{
                              title: 'RYKNSH Core を\n受け取る流れ',
                              steps: [
                                    { number: '01', label: 'RYKNSH Core を受け取る', description: '完全無料・永久' },
                                    { number: '02', label: '実演ウェビナーで使い方を学ぶ', description: '90分・無料' },
                                    { number: '03', label: '得意なことだけやる', description: '苦手なことは全部やってもらう' },
                              ],
                              cta: '全部無料であげます',
                        }}
                  />

                  {/* OpEd型: 5秒ブランドアニメーション（OP/ED共用） */}
                  <Composition
                        id="op-ed"
                        component={OpEd as React.ComponentType}
                        durationInFrames={150}   // 5秒 @ 30fps
                        fps={30}
                        width={1080}
                        height={1920}
                        defaultProps={{
                              logoText: 'RYKNSH CORE',
                              tagline: 'Power to the People',
                              role: 'op',   // 'op' | 'ed'
                        }}
                  />

                  {/* OpEd型: 正方形バリエーション */}
                  <Composition
                        id="op-ed-square"
                        component={OpEd as React.ComponentType}
                        durationInFrames={150}
                        fps={30}
                        width={1080}
                        height={1080}
                        defaultProps={{
                              logoText: 'RYKNSH CORE',
                              tagline: 'Power to the People',
                              role: 'op',
                        }}
                  />
            </>
      );
};

registerRoot(RemotionRoot);
