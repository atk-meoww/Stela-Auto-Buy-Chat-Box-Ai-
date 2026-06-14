require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, AttachmentBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const PREFIX = '?'; 
let isAiChatOpen = false; 

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

process.on('unhandledRejection', (reason, p) => console.error('❌ [Anti-Crash] Từ chối chưa xử lý:', p, 'Lý do:', reason));
process.on('uncaughtException', (err, origin) => console.error('❌ [Anti-Crash] Lỗi chưa bắt được:', err, 'Nguồn:', origin));

const DB_FILE = path.join(__dirname, 'database.json');
let database = { users: {}, staff: { admins: [], moderators: [] }, pendingPayments: {} };
const chatHistory = new Map();

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      database = JSON.parse(data);
      if (!database.users) database.users = {};
      if (!database.staff) database.staff = { admins: [], moderators: [] };
      if (!database.pendingPayments) database.pendingPayments = {};
      console.log(`💾 Đã đồng bộ thành công dữ liệu hệ thống từ database.json`);
    } else {
      saveDatabase();
    }
  } catch (err) {
    console.error('❌ Lỗi không tải được database.json:', err);
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Lỗi không ghi được file database.json:', err);
  }
}

function getUser(userId) {
  if (!database.users[userId]) {
    database.users[userId] = { points: 0, totalDeposited: 0 };
    saveDatabase();
  }
  return database.users[userId];
}

function isAdmin(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return database.staff.admins.includes(member.id);
}

function isMod(member) {
  if (isAdmin(member)) return true;
  return database.staff.moderators.includes(member.id);
}

loadDatabase();

function createStelaEmbed(title, description, color = 0x00FFCC) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`🌟 STELA NETWORK | ${title.toUpperCase()} 🌟`)
    .setDescription(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${description}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
    .setFooter({ text: 'StelaSMP Auto-System • Hệ thống vận hành tự động', iconURL: client.user?.displayAvatarURL() })
    .setTimestamp();
}

function genTransferCode() {
  return 'STELA_' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

const SHOP_ITEMS = {
  'STELA':        { price: 50000,  label: 'Rank STELA',        cmd: 'lp user {ign} parent set stela' },
  'STELA+':       { price: 70000,  label: 'Rank STELA+',       cmd: 'lp user {ign} parent set superstela+' },
  'STELA++':      { price: 120000, label: 'Rank STELA++',      cmd: 'lp user {ign} parent set kingstela++' },
  'SUPERSTELA+':  { price: 150000, label: 'Rank SUPERSTELA+',  cmd: 'lp user {ign} parent set superstela+' },
  'SUPERSTELA++': { price: 200000, label: 'Rank SUPERSTELA++', cmd: 'lp user {ign} parent set superstela++' },
  'KINGSTELA++':  { price: 250000, label: 'Rank KINGSTELA++',  cmd: 'lp user {ign} parent set kingstela++' },
  'CUSTOM':       { price: 500000, label: 'CUSTOM RANK',       cmd: null }, 
  'KEY_AMETHYST': { price: 20000,  label: 'Key Amethyst',      cmd: 'crate give amethyst 1 {ign}' },
  'KEY_GOLD':     { price: 10000,  label: 'Key Gold',          cmd: 'crate give gold 1 {ign}' },
  'KEY_PRIME':    { price: 10000,  label: 'Key Prime',         cmd: 'crate give prime 1 {ign}' },
  'KEY_CRIMSON':  { price: 20000,  label: 'Key Crimson',       cmd: 'crate give crimson 1 {ign}' },
  'KEY_VKHT':     { price: 20000,  label: 'Key VKHT',          cmd: 'crate give vkht 1 {ign}' },
  'FLY':          { price: 100000, label: 'Quyền FLY',         cmd: 'lp user {ign} permission set essentials.fly true' },
  'KIT_CUSTOM':   { price: 300000, label: 'KIT CUSTOM',        cmd: null } 
};

const helpEmbed = new EmbedBuilder()
  .setColor(0x5865F2)
  .setTitle('📚 Hướng Dẫn Sử Dụng Bot Server StelaSMP')
  .setDescription(`Hệ thống thông minh hỗ trợ đồng thời cả: Slash Command (/), Prefix (${PREFIX}) và Chat chữ thường trực tiếp!`)
  .addFields(
    { name: '💳 __NẠP TIỀN & KIỂM TRA VÍ__', value: `• Lệnh: \`napthe <nhà_mạng> <serial> <mã_thẻ> <mệnh_giá>\`\n• Lệnh: \`napbank <số_tiền>\`\n• Lệnh: \`sodu\`\n• Lệnh: \`lichsu\``, inline: false },
    { name: '🛒 __CỬA HÀNG VẬT PHẨM__', value: `• Lệnh: \`banggia\`\n• Lệnh: \`buy <mã_món_đồ> <IGN_tên_game> [yêu_cầu_nếu_có]\``, inline: false },
    { name: '💬 __TRỢ LÝ CHAT AI__', value: '• Bạn có thể thoải mái hỏi đáp mọi thông tin, AI sẽ tự động trả lời dựa trên file prompt cấu hình!', inline: false }
  ).setTimestamp();

const priceEmbed = new EmbedBuilder()
  .setColor(0xFFD700)
  .setTitle('💰 Bảng Giá Vật Phẩm & Gói — StelaSMP')
  .setDescription('Nạp tiền đổi lấy coin, dùng lệnh `buy` để mua hàng!\n**1,000đ = 1 coin**')
  .addFields(
    {
      name: '👑 __RANKS & ĐẶC QUYỀN__',
      value: ['`STELA` — **50,000 coin**','`STELA+` — **70,000 coin**','`STELA++` — **120,000 coin**','`SUPERSTELA+` — **150,000 coin**','`SUPERSTELA++` — **200,000 coin**','`KINGSTELA++` — **250,000 coin**','`FLY` — **100,000 coin**','`CUSTOM` — **500,000 coin**'].join('\n'),
      inline: false,
    },
    {
      name: '🗝️ __KEYS & KITS VŨ KHÍ__',
      value: ['`KEY_AMETHYST` — **20,000 coin**','`KEY_GOLD` — **10,000 coin**','`KEY_PRIME` — **10,000 coin**','`KEY_CRIMSON` — **20,000 coin**','`KEY_VKHT` — **20,000 coin**','`KIT_CUSTOM` — **300,000 coin**'].join('\n'),
      inline: false,
    }
  ).setTimestamp();

async function createPendingOrder(orderData) {
  if (!process.env.LOG_CHANNEL_ID) return;
  const logChannel = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
  if (!logChannel) return;

  const id = orderData.id;
  if (!database.pendingPayments) database.pendingPayments = {};
  database.pendingPayments[id] = orderData; 
  saveDatabase();

  let desc = `👤 **Người gửi:** <@${orderData.userId}> (\`${orderData.userId}\`)\n` +
             `📊 **Loại giao dịch:** \`${orderData.type.toUpperCase()}\`\n` +
             `💰 **Số tiền khai báo:** **${orderData.amount.toLocaleString()} VNĐ**\n`;

  if (orderData.type === 'card') {
    desc += `📱 **Nhà mạng:** \`${orderData.telco}\`\n📌 **Serial:** \`${orderData.serial}\`\n🔑 **Mã thẻ:** \`${orderData.code}\``;
  } else {
    desc += `📝 **Mã nội dung CK:** \`${orderData.id}\``;
  }

  const embed = createStelaEmbed(`Đơn Duyệt Mới [${orderData.type.toUpperCase()}]`, desc, 0xFFA500);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`approve_${id}`).setLabel('✅ DUYỆT THÀNH CÔNG').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`deny_${id}`).setLabel('❌ BÁO THẤT BẠI').setStyle(ButtonStyle.Danger)
  );

  await logChannel.send({
    content: orderData.type === 'card' 
      ? '⚠️ 📢 **CÓ THẺ CÀO MỚI CẦN CHECK DUYỆT TRÊN WEB ĐỐI TÁC!** <@&1445797855037227131>'
      : '⚠️ 📢 **CÓ BILL CHUYỂN KHOẢN BANK MỚI CẦN STAFF CHECK ĐỐI CHIẾU VÍ!** <@&1445797855037227131>',
    embeds: [embed],
    components: [row]
  });
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const underscoreIdx = interaction.customId.indexOf('_');
  const action = interaction.customId.substring(0, underscoreIdx);
  const id = interaction.customId.substring(underscoreIdx + 1);
  if (!database.pendingPayments) database.pendingPayments = {};
  const order = database.pendingPayments[id]; 

  if (!order) return interaction.reply({ content: '❌ Đơn hàng này không tồn tại hoặc đã được xử lý từ trước!', flags: ['Ephemeral'] });
  if (!isMod(interaction.member)) return interaction.reply({ content: '❌ Bạn không thuộc đội ngũ Ban Quản Trị (Staff) để thực hiện duyệt đơn này!', flags: ['Ephemeral'] });

  delete database.pendingPayments[id]; 
  saveDatabase();

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`approve_${id}`).setLabel('ĐÃ XỬ LÝ').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`deny_${id}`).setLabel('ĐÃ XỬ LÝ').setStyle(ButtonStyle.Secondary).setDisabled(true)
  );

  const userChan = client.channels.cache.get(order.channelId);
  const rate = parseInt(process.env.RATE) || 1000;
  const pointsEarned = Math.floor(order.amount / rate);

  if (action === 'approve') {
    const userData = getUser(order.userId);
    userData.points += pointsEarned;
    userData.totalDeposited += order.amount;
    saveDatabase();

    const staffEmbed = createStelaEmbed('Đơn Đã Duyệt Thành Công', `✅ Người duyệt: <@${interaction.user.id}>\n👤 Người mua: <@${order.userId}>\n💰 Số tiền: **${order.amount.toLocaleString()} VNĐ**\n⭐ Số xu cấp phát: \`+${pointsEarned.toLocaleString()}\` Coin`, 0x00FF00);
    await interaction.update({ embeds: [staffEmbed], components: [disabledRow] });

    if (userChan) {
      const userEmbed = order.type === 'card'
        ? createStelaEmbed('Nạp Thẻ Thành Công', `🎉 Chúc mừng <@${order.userId}>, thẻ cào mệnh giá **${order.amount.toLocaleString()}đ** của bạn đã được duyệt thành công!\n💰 Tài khoản được cộng: **+${pointsEarned.toLocaleString()} Coin**`, 0x00FF00)
        : createStelaEmbed('Nạp Tiền Bank Thành Công', `🎉 Hệ thống ghi nhận hóa đơn chuyển khoản ngân hàng trị giá **${order.amount.toLocaleString()}đ** thành công!\n💰 Tài khoản được cộng: **+${pointsEarned.toLocaleString()} Coin**`, 0x00FF00);
      userChan.send({ content: `<@${order.userId}>`, embeds: [userEmbed] });
    }

  } else if (action === 'deny') {
    const staffEmbed = createStelaEmbed('Đơn Đã Bị Hủy Bỏ', `❌ Người hủy đơn: <@${interaction.user.id}>\n👤 Người gửi đơn: <@${order.userId}>\n💰 Số tiền: **${order.amount.toLocaleString()} VNĐ**`, 0xFF3333);
    await interaction.update({ embeds: [staffEmbed], components: [disabledRow] });

    if (userChan) {
      const userEmbed = order.type === 'card'
        ? createStelaEmbed('Nạp Thẻ Thất Bại', `❌ Rất tiếc <@${order.userId}>, thẻ cào của bạn đã bị từ chối!\n⚠️ **Lý do:** Thẻ bị lỗi, sai mệnh giá, hoặc mã thẻ/serial đã được sử dụng từ trước.`, 0xFF3333)
        : createStelaEmbed('Hóa Đơn Bank Bị Từ Chối', `❌ <@${order.userId}>, hóa đơn chuyển khoản của bạn đã bị Staff từ chối duyệt.\n⚠️ **Lý do:** Nội dung ghi chú sai, số tiền chuyển không khớp, hoặc ảnh bill giả mạo.`, 0xFF3333);
      userChan.send({ content: `<@${order.userId}>`, embeds: [userEmbed] });
    }
  }
});

const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Xem toàn bộ hướng dẫn sử dụng bot StelaSMP'),
  new SlashCommandBuilder().setName('banggia').setDescription('Xem bảng giá rank & key của StelaSMP'),
  new SlashCommandBuilder().setName('sodu').setDescription('Xem số dư point của bạn'),
  new SlashCommandBuilder()
    .setName('addcoin')
    .setDescription('👑 [STAFF] Cộng coin thủ công cho người chơi')
    .addUserOption(o => o.setName('user').setDescription('Chọn người chơi').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Số lượng coin cần cộng').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands), 
  new SlashCommandBuilder()
    .setName('resetcoin')
    .setDescription('👑 [STAFF] Đưa số dư coin của người chơi về 0')
    .addUserOption(o => o.setName('user').setDescription('Chọn người chơi').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands), 
  new SlashCommandBuilder()
    .setName('napthe')
    .setDescription('Gửi thẻ cào chờ Staff check tay')
    .addStringOption(o => o.setName('nhamang').setDescription('Nhà mạng').setRequired(true).addChoices({ name: 'Viettel', value: 'VIETTEL' }, { name: 'Mobifone', value: 'MOBIFONE' }, { name: 'Vinaphone', value: 'VINAPHONE' }))
    .addStringOption(o => o.setName('serial').setDescription('Số serial thẻ').setRequired(true))
    .addStringOption(o => o.setName('mathe').setDescription('Mã thẻ (PIN)').setRequired(true))
    .addIntegerOption(o => o.setName('menh_gia').setDescription('Mệnh giá thẻ').setRequired(true).addChoices({ name: '10,000đ', value: 10000 }, { name: '20,000đ', value: 20000 }, { name: '50,000đ', value: 50000 }, { name: '100,000đ', value: 100000 }, { name: '200,000đ', value: 200000 }, { name: '500,000đ', value: 500000 })),
  new SlashCommandBuilder()
    .setName('napbank')
    .setDescription('Tạo đơn nạp qua ngân hàng')
    .addIntegerOption(o => o.setName('sotien').setDescription('Số tiền chuyển khoản').setRequired(true)),
  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Mua các gói dịch vụ bằng coin')
    .addStringOption(o => o.setName('item').setDescription('Chọn món đồ').setRequired(true).addChoices(
        { name: '👑 Rank STELA (50k coin)', value: 'STELA' }, { name: '👑 Rank STELA+ (70k coin)', value: 'STELA+' }, { name: '👑 Rank STELA++ (120k coin)', value: 'STELA++' }, { name: '👑 Rank SUPERSTELA+ (150k coin)', value: 'SUPERSTELA+' }, { name: '👑 Rank SUPERSTELA++ (200k coin)', value: 'SUPERSTELA++' }, { name: '👑 Rank KINGSTELA++ (250k coin)', value: 'KINGSTELA++' }, { name: '🎨 CUSTOM RANK (500k coin)', value: 'CUSTOM' }, { name: '⚔️ KIT CUSTOM (300k coin)', value: 'KIT_CUSTOM' }, { name: '✈️ Quyền FLY (100k coin)', value: 'FLY' }, { name: '🗝️ Key Amethyst (20k coin)', value: 'KEY_AMETHYST' }, { name: '🗝️ Key Crimson (20k coin)', value: 'KEY_CRIMSON' }, { name: '🗝️ Key VKHT (20k coin)', value: 'KEY_VKHT' }, { name: '🗝️ Key Gold (10k coin)', value: 'KEY_GOLD' }, { name: '🗝️ Key Prime (10k coin)', value: 'KEY_PRIME' }
    ))
    .addStringOption(o => o.setName('ign').setDescription('Nhập tên nhân vật trong game').setRequired(true))
    .addStringOption(o => o.setName('yeucau').setDescription('Mô tả (Chỉ bắt buộc khi mua hàng CUSTOM)').setRequired(false)),
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands.map(c => c.toJSON()) });
    console.log('✅ Đã làm mới hệ thống Slash Commands thành công.');
  } catch (err) { console.error(err); }
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, user } = interaction;

  if (commandName === 'help') return interaction.reply({ embeds: [helpEmbed] });
  if (commandName === 'banggia') return interaction.reply({ embeds: [priceEmbed] });
  
  if (commandName === 'sodu') {
    const data = getUser(user.id);
    return interaction.reply({ embeds: [createStelaEmbed('Thông Tin Ví', `👤 Tài khoản: <@${user.id}>\n💳 Số dư: **${data.points.toLocaleString()} Coin**\n📊 Tổng nạp: **${data.totalDeposited.toLocaleString()} VNĐ**`, 0x00FFCC)], flags: ['Ephemeral'] });
  }

  if (commandName === 'addcoin') {
    if (!isMod(interaction.member)) return interaction.reply({ content: '❌ Bạn không có quyền hạn Staff để dùng lệnh này!', flags: ['Ephemeral'] });
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    if (amount <= 0) return interaction.reply({ content: '❌ Số coin cộng vào phải lớn hơn 0!', flags: ['Ephemeral'] });
    
    const targetData = getUser(targetUser.id);
    targetData.points += amount;
    saveDatabase();
    return interaction.reply({ embeds: [createStelaEmbed('Cấp Phát Xu Thành Công', `👑 Đã cộng thành công **+${amount.toLocaleString()} Coin** vào tài khoản của <@${targetUser.id}>.`, 0x00FF00)] });
  }

  if (commandName === 'resetcoin') {
    if (!isMod(interaction.member)) return interaction.reply({ content: '❌ Bạn không có quyền hạn Staff để dùng lệnh này!', flags: ['Ephemeral'] });
    const targetUser = interaction.options.getUser('user');
    
    const targetData = getUser(targetUser.id);
    targetData.points = 0;
    saveDatabase();
    return interaction.reply({ embeds: [createStelaEmbed('Reset Xu Thành Công', `🧹 Đã đưa số dư Coin của người chơi <@${targetUser.id}> về mức số 0.`, 0xFF3333)] });
  }

  if (commandName === 'napthe') {
    const telco = interaction.options.getString('nhamang');
    const serial = interaction.options.getString('serial');
    const code = interaction.options.getString('mathe');
    const amount = interaction.options.getInteger('menh_gia');

    const orderId = genTransferCode();
    await createPendingOrder({ id: orderId, type: 'card', userId: user.id, channelId: interaction.channelId, amount, telco, serial, code });

    return interaction.reply({ embeds: [createStelaEmbed('Đơn Thẻ Cào Đã Gửi', `📦 Hệ thống đã tạo biên nhận nạp thẻ của bạn.\n🔖 Mã hóa đơn: \`${orderId}\`\n⚠️ **Vui lòng chờ Ban Quản Trị (Staff) kiểm tra và duyệt tay.** Thao tác có thể mất ít phút!`, 0x00BFFF)], flags: ['Ephemeral'] });
  }

  if (commandName === 'napbank') {
    const amount = interaction.options.getInteger('sotien');
    const orderId = genTransferCode();
    await createPendingOrder({ id: orderId, type: 'bank', userId: user.id, channelId: interaction.channelId, amount });

    const qrAttachment = new AttachmentBuilder(path.join(__dirname, 'assets', 'qr.png'), { name: 'qr.png' });
    const bankEmbed = createStelaEmbed('Tạo Hóa Đơn Ngân Hàng', `💰 Số tiền chuyển khoản: **${amount.toLocaleString()}đ**\n📝 Nội dung bắt buộc chuyển khoản: \`${orderId}\`\n\n📌 **Hướng dẫn:** Quét mã QR, chuyển đúng số tiền và ghi chính xác nội dung trên. Sau đó hãy gửi ảnh chụp hóa đơn thành công vào kênh chat này để Staff đối chiếu duyệt ví!`, 0x5865F2)
      .setImage('attachment://qr.png');

    return interaction.reply({ embeds: [bankEmbed], files: [qrAttachment] });
  }

  if (commandName === 'buy') {
    await interaction.deferReply({ flags: ['Ephemeral'] });
    const itemKey = interaction.options.getString('item').toUpperCase();
    const ign = interaction.options.getString('ign');
    const requestText = interaction.options.getString('yeucau') || 'Không có';
    const item = SHOP_ITEMS[itemKey];
    const userData = getUser(user.id);

    if ((itemKey === 'CUSTOM' || itemKey === 'KIT_CUSTOM') && requestText === 'Không có') {
      return interaction.editReply({ embeds: [createStelaEmbed('Lỗi Mua Hàng', '⚠️ Vật phẩm Custom bắt buộc điền thông tin mô tả vào ô `yeucau`!', 0xFF3333) ] });
    }
    if (userData.points < item.price) {
      return interaction.editReply({ embeds: [createStelaEmbed('Số Dư Không Đủ', `❌ Bạn thiếu **${(item.price - userData.points).toLocaleString()} Coin** để mua mặt hàng này.`, 0xFF3333) ] });
    }

    userData.points -= item.price;
    saveDatabase();

    let statusText = "⚠️ Đang chờ Staff phát trong game.";
    if (item.cmd) {
      const finalCmd = item.cmd.replace('{ign}', ign);
      const res = await executeConsoleCommand(finalCmd);
      statusText = res.success ? "✅ Hệ thống tự động phát thành công qua Panel!" : `❌ Panel sập (\`${res.error}\`). Staff sẽ cấp bù bằng tay!`;
    }

    const resEmbed = createStelaEmbed('Giao Dịch Thành Công', `🛒 Vật phẩm: **${item.label}**\n🎮 Tên nhân vật (IGN): \`${ign}\`\n📌 Trạng thái: ${statusText}`, 0x00FF00);
    await interaction.editReply({ embeds: [resEmbed] });

    if (process.env.LOG_CHANNEL_ID) {
      const logChan = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
      if (logChan) logChan.send({ content: `📢 Đơn hàng mới từ <@${user.id}>`, embeds: [resEmbed] });
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const raw = message.content.trim();
  const clean = raw.replace(/<@!?\d+>/g, '').trim();
  const user = message.author;
  const member = message.member;

  if (raw.startsWith('<addadmin') || raw.startsWith('<addmod') || raw.startsWith('<removeadmin') || raw.startsWith('<removemod')) {
    if (!isAdmin(member)) return message.reply('❌ Bạn không có quyền tối cao quản trị nhân sự!');
    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Vui lòng tag thành viên cần gán chức vụ.');

    if (raw.startsWith('<addadmin')) {
      if (!database.staff.admins.includes(target.id)) database.staff.admins.push(target.id);
    } else if (raw.startsWith('<addmod')) {
      if (!database.staff.moderators.includes(target.id)) database.staff.moderators.push(target.id);
    } else if (raw.startsWith('<removeadmin')) {
      database.staff.admins = database.staff.admins.filter(id => id !== target.id);
    } else if (raw.startsWith('<removemod')) {
      database.staff.moderators = database.staff.moderators.filter(id => id !== target.id);
    }
    message.reply('✅ Đã cập nhật phân quyền Staff mới thành công!');
    return saveDatabase();
  }

  // ĐÃ SỬA LỖI SYNTAXERROR: Xoá chữ "Pis" viết thừa gây văng lỗi hệ thống lúc nãy
  if (raw.startsWith('<addmoney')) {
    if (!isMod(member)) return message.reply('❌ Bạn không có quyền hạn Staff cấp xu!');
    const target = message.mentions.users.first();
    const args = clean.split(/ +/);
    const amount = parseInt(args[1]);
    if (!target || !amount || isNaN(amount)) return message.reply('⚠️ Gõ chuẩn cú pháp: `<addmoney @User [xu]>`');

    const targetData = getUser(target.id);
    targetData.points += amount;
    saveDatabase();
    return message.reply(`👑 Cộng thành công **+${amount.toLocaleString()} Coin** cho <@${target.id}>.`);
  }

  if (raw === '<close') {
    if (!isMod(member)) return message.reply('❌ Quyền Staff!');
    isAiChatOpen = false;
    return message.reply('🔒 Đã đóng cổng AI chat!');
  }
  if (raw === '<open') {
    if (!isMod(member)) return message.reply('❌ Quyền Staff!');
    isAiChatOpen = true;
    return message.reply('🔓 Đã mở cổng AI chat!');
  }

  let isCmd = false;
  let args = [];

  if (raw.startsWith(PREFIX)) {
    args = raw.slice(PREFIX.length).trim().split(/ +/);
    isCmd = ['help', 'banggia', 'sodu', 'napthe', 'napbank', 'buy'].includes(args[0]?.toLowerCase());
  } else {
    args = raw.split(/ +/);
    isCmd = ['help', 'banggia', 'sodu', 'napthe', 'napbank', 'buy'].includes(args[0]?.toLowerCase());
  }

  if (isCmd) {
    const cmd = args.shift().toLowerCase();

    if (cmd === 'help') return message.channel.send({ embeds: [helpEmbed] });
    if (cmd === 'banggia') return message.channel.send({ embeds: [priceEmbed] });
    
    if (cmd === 'sodu') {
      const data = getUser(user.id);
      return message.reply({ embeds: [createStelaEmbed('Thông Tin Ví', `👤 Tài khoản: <@${user.id}>\n💳 Số dư: **${data.points.toLocaleString()} Coin**\n📊 Tổng nạp: **${data.totalDeposited.toLocaleString()} VNĐ**`, 0x00FFCC)] });
    }

    if (cmd === 'napthe') {
      const telco = args[0]?.toUpperCase();
      const serial = args[1];
      const code = args[2];
      const amount = parseInt(args[3]);

      if (!telco || !serial || !code || !amount || isNaN(amount)) {
        return message.reply({ embeds: [createStelaEmbed('Sai Cú Pháp', `⚠️ Cú pháp chat chuẩn:\n\`napthe <nhà_mạng> <serial> <mã_thẻ_pin> <mệnh_giá>\`\n*(Ví dụ: \`napthe VIETTEL 123456 789012 50000\`)*`, 0xFF3333)] });
      }

      const orderId = genTransferCode();
      await createPendingOrder({ id: orderId, type: 'card', userId: user.id, channelId: message.channelId, amount, telco, serial, code });
      return message.reply({ embeds: [createStelaEmbed('Đơn Thẻ Cào Đã Gửi', `📦 Đã nhận đơn thẻ cào của bạn.\n🔖 Mã hóa đơn: \`${orderId}\`\n⚠️ Ban quản trị đang tiến hành xác minh duyệt tay thủ công!`, 0x00BFFF)] });
    }

    if (cmd === 'napbank') {
      const amount = parseInt(args[0]);
      if (!amount || isNaN(amount)) return message.reply('⚠️ Cú pháp chat: `napbank <số_tiền>` (Ví dụ: `napbank 50000`)');

      const orderId = genTransferCode();
      await createPendingOrder({ id: orderId, type: 'bank', userId: user.id, channelId: message.channelId, amount });

      const qrAttachment = new AttachmentBuilder(path.join(__dirname, 'assets', 'qr.png'), { name: 'qr.png' });
      const bankEmbed = createStelaEmbed('Tạo Hóa Đơn Ngân Hàng', `💰 Số tiền chuyển khoản: **${amount.toLocaleString()}đ**\n📝 Nội dung bắt buộc: \`${orderId}\`\n\n📌 Hãy quét QR hoặc nhập thông tin chuyển khoản trên, sau đó đăng ảnh bill thành công lên kênh chat này để Staff đối chiếu duyệt xu!`, 0x5865F2).setImage('attachment://qr.png');
      return message.channel.send({ embeds: [bankEmbed], files: [qrAttachment] });
    }

    if (cmd === 'buy') {
      const itemKey = args[0]?.toUpperCase();
      const ign = args[1];
      const requestText = args.slice(2).join(' ') || 'Không có';
      const item = SHOP_ITEMS[itemKey];
      const userData = getUser(user.id);

      if (!itemKey || !ign || !item) {
        return message.reply({ embeds: [createStelaEmbed('Sai Cú Pháp', `⚠️ Vui lòng gõ định dạng:\n\`buy <mã_vật_phẩm> <tên_IGN_game> [yêu_cầu_nếu_có]\``, 0xFF3333)] });
      }
      if ((itemKey === 'CUSTOM' || itemKey === 'KIT_CUSTOM') && requestText === 'Không có') {
        return message.reply({ embeds: [createStelaEmbed('Thiếu Ghi Chú', '⚠️ Các mặt hàng Custom yêu cầu ghi mô tả chi tiết ở cuối dòng lệnh!', 0xFF3333)] });
      }
      if (userData.points < item.price) {
        return message.reply({ embeds: [createStelaEmbed('Số Dư Không Đủ', `❌ Bạn thiếu **${(item.price - userData.points).toLocaleString()} Coin** để mua.`, 0xFF3333)] });
      }

      userData.points -= item.price;
      saveDatabase();

      let statusText = "⚠️ Đang chờ Staff phát đồ bằng tay.";
      if (item.cmd) {
        const finalCmd = item.cmd.replace('{ign}', ign);
        const res = await executeConsoleCommand(finalCmd);
        statusText = res.success ? "✅ Hệ thống tự động gán cấp phát thành công!" : `❌ Gặp sự cố Panel: \`${res.error}\`. Staff sẽ đền tay!`;
      }

      const resEmbed = createStelaEmbed('Giao Dịch Thành Công', `🛒 Vật phẩm: **${item.label}**\n🎮 Tên nhân vật: \`${ign}\`\n📌 Trạng thái: ${statusText}`, 0x00FF00);
      message.reply({ embeds: [resEmbed] });

      if (process.env.LOG_CHANNEL_ID) {
        const logChan = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
        if (logChan) logChan.send({ content: `📢 Đơn hàng mới từ <@${user.id}>`, embeds: [resEmbed] });
      }
      return;
    }
  }

  if (!isAiChatOpen || !clean) return;
  
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) return;
  
  const groqInstance = new (require('groq-sdk'))({ apiKey: groqApiKey });
  if (!chatHistory.has(user.id)) chatHistory.set(user.id, []);
  const hist = chatHistory.get(user.id);
  hist.push({ role: 'user', content: clean });
  if (hist.length > 20) hist.shift();

  try {
    let systemPrompt = "Bạn là trợ lý AI thông minh của Stela. Hãy trả lời ngắn gọn, ngầu và hữu ích.";
    if (fs.existsSync(path.join(__dirname, 'prompt.txt'))) {
      systemPrompt = fs.readFileSync(path.join(__dirname, 'prompt.txt'), 'utf8').trim();
    }
    await message.channel.sendTyping();
    const response = await groqInstance.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'system', content: systemPrompt }, ...hist],
    });
    const reply = response.choices[0].message.content;
    hist.push({ role: 'assistant', content: reply });
    const chunks = reply.match(/[\s\S]{1,1900}/g) || [reply];
    for (const chunk of chunks) await message.reply(chunk);
  } catch (err) {
    hist.pop();
  }
});

async function executeConsoleCommand(command) {
  const url = `${process.env.PANEL_URL}/api/client/servers/${process.env.PANEL_SERVER_ID}/command`;
  try {
    await axios.post(url, { command }, {
      headers: {
        'Authorization': `Bearer ${process.env.PANEL_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 7000
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.response?.data?.errors?.[0]?.detail || err.message };
  }
}

client.once('ready', () => {
  console.log(`🚀 Bot "DUYỆT TAY STAFF QUA NÚT BẤM" hoàn chỉnh đã online: ${client.user.tag}`);
  registerCommands();
});

client.login(process.env.DISCORD_TOKEN);
app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log(`🌐 Web Server lắng nghe tại cổng ${process.env.PORT || 3000}`));