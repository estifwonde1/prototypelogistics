# frozen_string_literal: true

module Cats
  module Warehouse
    # Raised when a receipt would exceed the physical capacity of a stack or
    # store.  Callers (e.g. GrnConfirmer) should rescue this and surface it as
    # a 422 Unprocessable Entity with the message intact.
    class InsufficientSpaceError < StandardError; end
  end
end
