<script>
import CustomButton from 'shared/components/Button.vue';
import Spinner from 'shared/components/Spinner.vue';
import { mapGetters } from 'vuex';
import { getContrastingTextColor } from '@chatwoot/utils';
import { isEmptyObject } from 'widget/helpers/utils';
import { getRegexp } from 'shared/helpers/Validators';
import { useMessageFormatter } from 'shared/composables/useMessageFormatter';
import configMixin from 'widget/mixins/configMixin';
import { FormKit, createInput } from '@formkit/vue';
import PhoneInput from 'widget/components/Form/PhoneInput.vue';

export default {
  components: {
    CustomButton,
    Spinner,
    FormKit,
  },
  mixins: [configMixin],
  props: {
    options: {
      type: Object,
      default: () => {},
    },
  },
  emits: ['submitPreChat'],
  setup() {
    const phoneInput = createInput(PhoneInput, {
      props: ['hasErrorInPhoneInput', 'allowedCountries', 'phoneMask'],
    });
    const { formatMessage } = useMessageFormatter();

    return { formatMessage, phoneInput };
  },
  data() {
    return {
      locale: this.$root.$i18n.locale,
      hasErrorInPhoneInput: false,
      message: '',
      formValues: {},
      labels: {
        emailAddress: 'EMAIL_ADDRESS',
        fullName: 'FULL_NAME',
        phoneNumber: 'PHONE_NUMBER',
      },
    };
  },
  computed: {
    ...mapGetters({
      widgetColor: 'appConfig/getWidgetColor',
      isCreating: 'conversation/getIsCreating',
      isConversationRouting: 'appConfig/getIsUpdatingRoute',
      activeCampaign: 'campaign/getActiveCampaign',
      currentUser: 'contacts/getCurrentUser',
    }),
    isCreatingConversation() {
      return this.isCreating || this.isConversationRouting;
    },
    textColor() {
      return getContrastingTextColor(this.widgetColor);
    },
    hasActiveCampaign() {
      return !isEmptyObject(this.activeCampaign);
    },
    shouldShowHeaderMessage() {
      return (
        this.hasActiveCampaign ||
        (this.preChatFormEnabled && !!this.headerMessage)
      );
    },
    headerMessage() {
      if (this.preChatFormEnabled) {
        return this.options.preChatMessage;
      }
      if (this.hasActiveCampaign) {
        return this.$t('PRE_CHAT_FORM.CAMPAIGN_HEADER');
      }
      return '';
    },
    preChatFields() {
      return this.preChatFormEnabled ? this.options.preChatFields : [];
    },
    filteredPreChatFields() {
      const isUserEmailAvailable = this.currentUser.has_email;
      const isUserPhoneNumberAvailable = this.currentUser.has_phone_number;
      const isUserIdentifierAvailable = !!this.currentUser.identifier;

      const isUserNameAvailable = !!(
        isUserIdentifierAvailable ||
        isUserEmailAvailable ||
        isUserPhoneNumberAvailable
      );
      return this.preChatFields.filter(field => {
        if (isUserEmailAvailable && field.name === 'emailAddress') {
          return false;
        }
        if (isUserPhoneNumberAvailable && field.name === 'phoneNumber') {
          return false;
        }
        if (isUserNameAvailable && field.name === 'fullName') {
          return false;
        }
        return true;
      });
    },
    enabledPreChatFields() {
      return this.filteredPreChatFields
        .filter(field => field.enabled)
        .map(field => {
          const mappedField = {
            ...field,
            type:
              field.name === 'phoneNumber'
                ? this.phoneInput
                : this.findFieldType(field.type),
          };
          
          // Add phone-specific props
          if (field.name === 'phoneNumber') {
            mappedField.allowed_countries = field.allowed_countries || this.allowedCountries;
            mappedField.phone_mask = field.phone_mask || '(###) ###-####';
          }
          
          return mappedField;
        });
    },
    conversationCustomAttributes() {
      let conversationAttributes = {};
      this.enabledPreChatFields.forEach(field => {
        if (field.field_type === 'conversation_attribute') {
          conversationAttributes = {
            ...conversationAttributes,
            [field.name]: this.getValue(field),
          };
        }
      });
      return conversationAttributes;
    },
    contactCustomAttributes() {
      let contactAttributes = {};
      this.enabledPreChatFields.forEach(field => {
        if (field.field_type === 'contact_attribute') {
          contactAttributes = {
            ...contactAttributes,
            [field.name]: this.getValue(field),
          };
        }
      });
      return contactAttributes;
    },
    allowedCountries() {
      return ['RU'];
    },
  },
  methods: {
    labelClass(input) {
      const { state } = input.context;
      const hasErrors = state.invalid;
      return !hasErrors ? 'text-n-slate-12' : 'text-n-ruby-10';
    },
    inputClass(input) {
      const { state, family: classification, type } = input.context;
      const hasErrors = state.invalid;
      if (classification === 'box' && type === 'checkbox') {
        return '';
      }
      if (type === 'phoneInput') {
        this.hasErrorInPhoneInput = hasErrors;
      }
      if (!hasErrors) {
        return `mt-1 rounded w-full py-2 px-3`;
      }
      return `mt-1 rounded w-full py-2 px-3 error`;
    },
    isContactFieldRequired(field) {
      return this.preChatFields.find(option => option.name === field).required;
    },
    getLabel({ label }) {
      return label;
    },
    getPlaceHolder({ placeholder }) {
      return placeholder;
    },
    getValue({ name, type }) {
      if (type === 'select') {
        return this.enabledPreChatFields.find(option => option.name === name)
          .values[this.formValues[name]];
      }
      return this.formValues[name] || null;
    },
    getValidation({ type, name, field_type, regex_pattern }) {
      let regex = regex_pattern ? getRegexp(regex_pattern) : null;
      
      const validations = {
        emailAddress: 'email',
        phoneNumber: ['startsWithPlus', 'isValidPhoneNumber'],
        url: 'url',
        date: 'date',
        text: null,
        select: null,
        number: null,
        checkbox: false,
        contact_attribute: regex ? [['matches', regex]] : null,
        conversation_attribute: regex ? [['matches', regex]] : null,
      };
      const validationKeys = Object.keys(validations);
      const isRequired = this.isContactFieldRequired(name);
      const validation = isRequired ? ['required'] : ['optional'];

      if (
        validationKeys.includes(name) ||
        validationKeys.includes(type) ||
        validationKeys.includes(field_type)
      ) {
        let validationType =
          validations[type] || validations[name] || validations[field_type];
        
        // Add regex validation for phoneNumber if regex_pattern is provided
        if (name === 'phoneNumber' && regex_pattern && validationType) {
          // Convert to array if it's not already
          const validationArray = Array.isArray(validationType)
            ? [...validationType]
            : [validationType];
          // Use the regex pattern string, not the compiled RegExp object
          validationArray.push(['matches', regex]);
          validationType = validationArray;
        }
        
        const allValidations = validationType
          ? validation.concat(validationType)
          : validation;
        
        // Flatten nested arrays and join with |
        const flattened = allValidations.map(v => {
          if (Array.isArray(v)) {
            // For matches validation, format as matches:/pattern/
            if (v[0] === 'matches' && v[1] instanceof RegExp) {
              const pattern = v[1].source;
              const flags = v[1].flags;
              return `matches:/${pattern}/${flags}`;
            }
            return v.join(':');
          }
          return v;
        });
        
        return flattened.join('|');
      }

      return '';
    },
    findFieldType(type) {
      if (type === 'link') {
        return 'url';
      }
      if (type === 'list') {
        return 'select';
      }

      return type;
    },
    getOptions(item) {
      if (item.type === 'select') {
        let values = {};
        item.values.forEach((value, index) => {
          values = {
            ...values,
            [index]: value,
          };
        });
        return values;
      }
      return {};
    },
    onSubmit() {
      const { emailAddress, fullName, phoneNumber, message } = this.formValues;
      this.$emit('submitPreChat', {
        fullName,
        phoneNumber,
        emailAddress,
        message: message || '',
        activeCampaignId: this.activeCampaign.id,
        conversationCustomAttributes: this.conversationCustomAttributes,
        contactCustomAttributes: this.contactCustomAttributes,
      });
    },
  },
};
</script>

<template>
  <!-- hide the default submit button for now -->
  <FormKit
    v-model="formValues"
    type="form"
    form-class="flex flex-col flex-1 w-full p-6 overflow-y-auto"
    :incomplete-message="false"
    :submit-attrs="{
      inputClass: 'hidden',
      wrapperClass: 'hidden',
    }"
    @submit="onSubmit"
  >
    <div
      v-if="shouldShowHeaderMessage"
      v-dompurify-html="formatMessage(headerMessage, false)"
      class="mb-4 text-base leading-5 text-n-slate-12 [&>p>.link]:text-n-blue-text [&>p>.link]:hover:underline"
    />
    <!-- Why do the v-bind shenanigan? Because Formkit API is really bad.
    If we just pass the options as is even with null or undefined or false,
    it assumes we are trying to make a multicheckbox. This is the best we have for now -->
    <FormKit
      v-for="item in enabledPreChatFields"
      :key="item.name"
      :name="item.name"
      :type="item.type"
      :label="getLabel(item)"
      :placeholder="getPlaceHolder(item)"
      :validation="getValidation(item)"
      v-bind="
        item.type === 'select'
          ? {
              options: getOptions(item),
            }
          : undefined
      "
      :label-class="context => `text-sm font-medium ${labelClass(context)}`"
      :input-class="context => inputClass(context)"
      :validation-messages="{
        startsWithPlus: $t(
          'PRE_CHAT_FORM.FIELDS.PHONE_NUMBER.DIAL_CODE_VALID_ERROR'
        ),
        isValidPhoneNumber: $t('PRE_CHAT_FORM.FIELDS.PHONE_NUMBER.VALID_ERROR'),
        email: $t('PRE_CHAT_FORM.FIELDS.EMAIL_ADDRESS.VALID_ERROR'),
        required: $t('PRE_CHAT_FORM.REQUIRED'),
        matches: item.regex_cue
          ? item.regex_cue
          : $t('PRE_CHAT_FORM.REGEX_ERROR'),
      }"
      :has-error-in-phone-input="hasErrorInPhoneInput"
      :allowed-countries="allowedCountries"
      :phone-mask="'(###) ###-####'"
    />

    <CustomButton
      class="mt-3 mb-5 font-medium flex items-center justify-center gap-2"
      block
      :bg-color="widgetColor"
      :text-color="textColor"
      :disabled="isCreatingConversation"
    >
      <Spinner v-if="isCreatingConversation" class="p-0" />
      {{ $t('START_CONVERSATION') }}
    </CustomButton>
  </FormKit>
</template>

<style lang="scss">
.formkit-outer {
  @apply mt-2;

  .formkit-inner {
    input.error,
    textarea.error,
    select.error {
      @apply outline-n-ruby-8 dark:outline-n-ruby-8 hover:outline-n-ruby-9 dark:hover:outline-n-ruby-9 focus:outline-n-ruby-9 dark:focus:outline-n-ruby-9;
    }

    input[type='checkbox'] {
      @apply size-4 outline-none;
    }
  }
}

[data-invalid] .formkit-message {
  @apply text-n-ruby-10 block text-xs font-normal my-0.5 w-full;
}

.formkit-outer[data-type='checkbox'] .formkit-wrapper {
  @apply flex items-center gap-2 px-0.5;
}

.formkit-messages {
  @apply list-none m-0 p-0;
}
</style>
