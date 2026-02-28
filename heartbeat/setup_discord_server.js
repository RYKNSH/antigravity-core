const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CONFIG_PATH = path.join(__dirname, 'config.json');
const CONFIG = require(CONFIG_PATH);

if (!TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN not found');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const ARCH = {
  roles: [
    { name: 'Core Team', color: 'E91E63', permissions: [PermissionFlagsBits.Administrator] },
    { name: 'Engineer', color: '2196F3', permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    { name: 'Growth', color: '4CAF50', permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    { name: 'Ops', color: 'FFC107', permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    { name: 'AI Swarm', color: '9C27B0', permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
  ],
  categories: [
    {
      name: '00-本社',
      position: 0,
      channels: [
        { 
          key: 'town_hall', name: '📢-全社広報', type: ChannelType.GuildText, position: 0,
          topic: '【全社アナウンス】CEO/Jensenからの重要なお知らせやビジョン共有。',
          readOnly: true // Engineer/Growth/Ops cannot send messages
        },
        { 
          key: 'board_room', name: '🧠-経営会議', type: ChannelType.GuildText, position: 1,
          topic: '【戦略策定】株主とエージェント代表による意思決定の場。' 
        },
        { 
          key: 'metrics', name: '📊-経営指標', type: ChannelType.GuildText, position: 2,
          topic: '【KPI監視】売上、Burn rate、システム稼働率のリアルタイム表示。',
          readOnly: true
        }
      ]
    },
    {
      name: '10-開発部',
      position: 1,
      channels: [
        { key: 'core_systems', name: '💎-基盤システム', type: ChannelType.GuildText, position: 0, topic: '【インフラ】OS, Heartbeat, Docker等の低レイヤー開発議論。' },
        { key: 'product_dev', name: '🚀-製品開発', type: ChannelType.GuildText, position: 1, topic: '【アプリ実装】機能追加、UI改善などの具体的指示はこちらへ。Botが常駐中。' },
        { key: 'bug_bounty', name: '🐛-バグ報告', type: ChannelType.GuildText, position: 2, topic: '【障害対応】エラーログの貼り付けや不具合報告。優先度高で処理されます。' },
        { key: 'live_terminal', name: '⚡-実行ログ', type: ChannelType.GuildText, position: 3, topic: '【マトリックス】全エージェントの思考と実行ログが流れる場所。', readOnly: true }
      ]
    },
    {
      name: '20-成長戦略部',
      position: 2,
      channels: [
        { key: 'social_media', name: '🌍-SNS運用', type: ChannelType.GuildText, position: 0, topic: '【広報活動】X/YouTube/Blog投稿の自動生成・承認フロー。' },
        { key: 'market_analysis', name: '📈-市場分析', type: ChannelType.GuildText, position: 1, topic: '【リサーチ】トレンド分析レポートや競合調査結果。' },
        { key: 'revenue_ops', name: '💰-売上管理', type: ChannelType.GuildText, position: 2, topic: '【ファイナンス】Stripe連携通知、売上速報。' }
      ]
    },
    {
      name: '90-管理部',
      position: 3,
      channels: [
        { key: 'welcome', name: '👋-受付', type: ChannelType.GuildText, position: 0, topic: '【オンボーディング】新入社員（AI/Human）の挨拶とロール付与。', readOnly: true },
        { key: 'policies', name: '📜-社内規定', type: ChannelType.GuildText, position: 1, topic: '【ルールブック】コーディング規約、デプロイポリシー等。', readOnly: true },
        { key: 'security', name: '🛡️-セキュリティ', type: ChannelType.GuildText, position: 2, topic: '【監視室】不正アクセスや異常検知のアラート。', readOnly: true }
      ]
    },
    {
      name: '99-システム管理',
      position: 4,
      channels: [
        { key: 'approvals', name: '🔒-承認コックピット', type: ChannelType.GuildText, position: 0, topic: '【承認ゲート】Botからの重要なアクション承認依頼。ボタン操作のみ。' },
        { key: 'alerts', name: '❌-緊急アラート', type: ChannelType.GuildText, position: 1, topic: '【エラー通知】システムダウンやクリティカルな不具合の通知。' },
        { key: 'system_health', name: '💻-システムヘルス', type: ChannelType.GuildText, position: 2, topic: '【ハードウェア】メモリ・ディスク・プロセスの稼働状況監視。' }
      ]
    }
  ]
};

async function setupServer(guild) {
  console.log(`🏗️ Setting up server: ${guild.name}`);
  const ids = {};

  // Create Roles
  if (ARCH.roles) {
    for (const roleDef of ARCH.roles) {
      let role = guild.roles.cache.find(r => r.name === roleDef.name);
      if (!role) {
        try {
          role = await guild.roles.create({
            name: roleDef.name,
            colors: roleDef.color,
            permissions: roleDef.permissions,
            reason: 'Antigravity OS Auto-Setup'
          });
          console.log(`  👤 Created Role: ${roleDef.name}`);
        } catch (e) {
          console.error(`  ❌ Failed to create role ${roleDef.name}: ${e.message}`);
        }
      } else {
        console.log(`    Found Role: ${roleDef.name}`);
      }
    }
  }

  for (const cat of ARCH.categories) {
    let category = guild.channels.cache.find(c => c.name === cat.name && c.type === ChannelType.GuildCategory);
    if (!category) {
      category = await guild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        position: cat.position
      });
      console.log(`  📂 Created Category: ${cat.name}`);
    } else {
      if (category.position !== cat.position) {
        await category.setPosition(cat.position);
        console.log(`  📂 Updated Category Position: ${cat.name}`);
      }
    }

    for (const chan of cat.channels) {
      let channel = guild.channels.cache.find(c => c.name === chan.name && c.parentId === category.id);
      
      const permissions = [];
      if (chan.readOnly) {
        permissions.push({
          id: guild.id, // @everyone
          deny: [PermissionFlagsBits.SendMessages],
          allow: [PermissionFlagsBits.ViewChannel]
        });
        const botRole = guild.roles.cache.find(r => r.name === 'AI Swarm');
        if (botRole) {
            permissions.push({
                id: botRole.id,
                allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel]
            });
        }
      }

      if (!channel) {
        channel = await guild.channels.create({
          name: chan.name,
          type: chan.type,
          parent: category.id,
          topic: chan.topic,
          position: chan.position,
          permissionOverwrites: permissions
        });
        console.log(`    Created Channel: ${chan.name}`);
      } else {
        console.log(`    Found Channel: ${chan.name}`);
        if (channel.topic !== chan.topic) {
            await channel.setTopic(chan.topic);
            console.log(`    Updated Topic: ${chan.name}`);
        }
        if (channel.position !== chan.position) {
            await channel.setPosition(chan.position);
            console.log(`    Updated Position: ${chan.name}`);
        }
        if (chan.readOnly) {
             await channel.permissionOverwrites.set(permissions);
             console.log(`    Updated Permissions: ${chan.name}`);
        }
      }
      
      const key = chan.key || chan.name.replace(/^[^\w]+-/, '').replace(/-/g, '_');
      ids[key] = channel.id;
    }
  }

  // Update config.json
  const newConfig = { ...CONFIG };
  Object.keys(ids).forEach(key => {
    if (newConfig.notifications.channels) {
      newConfig.notifications.channels[key] = ids[key];
    }
  });

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 4));
  console.log('✅ config.json updated with new channel IDs');
  
  const controlCenterKey = Object.keys(ids).find(k => k.includes('product_dev') || k.includes('town_hall'));
  const controlCenter = guild.channels.cache.get(ids[controlCenterKey]);
  if (controlCenter) {
    controlCenter.send('🏰 **Antigravity HQ Deployed**\n\nAll systems online. Waiting for commands.\n\n`@Antigravity [command]` or just type here.');
  }

  // --- Cleanup Logic (Destructive) ---
  console.log('🧹 Cleanup Mode: Deleting deprecated channels...');
  
  const definedChannelIds = new Set(Object.values(ids));
  
  const allChannels = await guild.channels.fetch();
  for (const [chanId, channel] of allChannels) {
    if (definedChannelIds.has(chanId)) continue;

    if (channel.type === ChannelType.GuildCategory && channel.name === '99-ARCHIVE') {
        try {
            await channel.delete();
            console.log(`  🗑️ Deleted Category: ${channel.name}`);
        } catch (e) {
            console.error(`  ❌ Failed to delete category ${channel.name}: ${e.message}`);
        }
        continue;
    }
    
    if (channel.type === ChannelType.GuildText) {
         try {
            await channel.delete();
            console.log(`  🗑️ Deleted Channel: ${channel.name}`);
         } catch (e) {
            console.error(`  ❌ Failed to delete ${channel.name}: ${e.message}`);
         }
    }
  }

  for (const [chanId, channel] of allChannels) {
      if (channel.type === ChannelType.GuildCategory) {
          const isDefinedCategory = ARCH.categories.some(c => c.name === channel.name);
          if (!isDefinedCategory && (channel.name === '99-ARCHIVE' || channel.name === '99-SYSTEM' || channel.name === 'General')) {
               try {
                await channel.delete();
                console.log(`  🗑️ Deleted Old Category: ${channel.name}`);
             } catch (e) {
                console.error(`  ❌ Failed to delete category ${channel.name}: ${e.message}`);
             }
          }
      }
  }
}

client.once('ready', async () => {
  console.log(`🤖 Setup Bot active: ${client.user.tag}`);
  
  if (!client.application?.owner) await client.application?.fetch();
  console.log(`🔗 Invite Link: https://discord.com/api/oauth2/authorize?client_id=${client.application.id}&permissions=8&scope=bot`);

  const guild = client.guilds.cache.first();
  if (guild) {
    await setupServer(guild);
    process.exit(0);
  } else {
    console.log('⏳ Waiting for guild invite...');
  }
});

client.on('guildCreate', async guild => {
  await setupServer(guild);
  process.exit(0);
});

client.login(TOKEN);
