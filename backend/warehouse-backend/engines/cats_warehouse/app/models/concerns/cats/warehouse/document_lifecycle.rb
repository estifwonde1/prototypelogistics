module Cats
  module Warehouse
    module DocumentLifecycle
      extend ActiveSupport::Concern
      include ContractConstants

      included do
        before_validation :normalize_document_status
        before_validation :apply_default_document_status

        enum :status, DOCUMENT_STATUSES, prefix: true

        validates :status, presence: true
        validate :status_must_be_supported
      end

      def ensure_confirmable!
        ensure_transition_allowed!(:confirmed)
      end

      def transition_allowed?(to_status)
        current_status = canonical_document_status_key_for(status)
        target_status = canonical_document_status_key_for(to_status)
        return false if current_status.blank? || target_status.blank?

        DOCUMENT_STATUS_TRANSITIONS.fetch(current_status, []).include?(target_status)
      end

      def ensure_transition_allowed!(to_status)
        return if transition_allowed?(to_status)

        target_status = canonical_document_status_for(to_status) || to_status.to_s
        raise ArgumentError, "#{self.class.name.demodulize} cannot transition from #{status} to #{target_status}"
      end

      private

      def normalize_document_status
        return if status.blank?

        normalized_status = canonical_document_status_for(status)

        self.status = normalized_status if normalized_status.present?
      end

      def apply_default_document_status
        self.status = DOCUMENT_STATUSES[:draft] if status.blank?
      end

      def status_must_be_supported
        return if status.blank?

        raw_status = status_before_type_cast.presence || self[:status].presence || status
        return if canonical_document_status_for(raw_status).present?

        errors.add(:status, "is not included in the list")
      end

      def canonical_document_status_for(value)
        key = canonical_document_status_key_for(value)
        return if key.blank?

        DOCUMENT_STATUSES[key]
      end

      def canonical_document_status_key_for(value)
        raw_status = value.to_s.strip
        return if raw_status.blank?

        status_key = raw_status.downcase.tr(" ", "_").to_sym
        return status_key if DOCUMENT_STATUSES.key?(status_key)

        DOCUMENT_STATUSES.find { |_key, candidate| candidate.casecmp?(raw_status) }&.first
      end
    end
  end
end
