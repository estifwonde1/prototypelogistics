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
        raise ArgumentError, "#{self.class.name.demodulize} is already confirmed" if status_confirmed?
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
        raw_status = value.to_s.strip
        return if raw_status.blank?

        DOCUMENT_STATUSES[raw_status.downcase.to_sym] ||
          DOCUMENT_STATUSES.values.find { |candidate| candidate.casecmp?(raw_status) }
      end
    end
  end
end
