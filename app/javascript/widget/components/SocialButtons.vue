<script>
import TelegramIcon from '../assets/images/tg.png';
import WhatsAppIcon from '../assets/images/whatsapp.png';

export default {
  name: 'SocialButtons',
  data() {
    return {
      telegramIcon: TelegramIcon,
      whatsappIcon: WhatsAppIcon,
    };
  },
};
</script>

<template>
  <div class="flex flex-col items-center gap-3 px-6 pb-6">
    <div class="flex items-center gap-2 w-full">
      <div class="flex-1 h-px bg-[#ECECEE]"></div>
      <span class="contact-via-text">
        {{ $t('SOCIAL_BUTTONS.CONTACT_VIA') }}
      </span>
      <div class="flex-1 h-px bg-[#ECECEE]"></div>
    </div>
    <div class="flex gap-2 w-full">
      <a
        href="https://t.me/academybmw"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-[10px] bg-[#eeeeee] transition-colors font-medium text-sm"
      >
        <img :src="telegramIcon" alt="Telegram" class="w-6 h-6" />
        <span>{{ $t('SOCIAL_BUTTONS.TELEGRAM') }}</span>
      </a>
      <a
        href="https://api.whatsapp.com/send/?phone=79162035500&text&type=phone_number&app_absent=0"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-[10px] bg-[#eeeeee] transition-colors font-medium text-sm"
      >
        <img :src="whatsappIcon" alt="WhatsApp" class="w-6 h-6" />
        <span>{{ $t('SOCIAL_BUTTONS.WHATSAPP') }}</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.contact-via-text {
  font-size: 14px;
  color: #95959D;
  white-space: nowrap;
}
</style>
