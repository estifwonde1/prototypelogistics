require "json"
require "time"

module Logging
  class JsonFormatter
    def call(severity, time, progname, msg)
      payload = normalize_message(msg)
      payload[:severity] = severity
      payload[:time] = time.utc.iso8601
      payload[:progname] = progname if progname
      "#{payload.to_json}\n"
    end

    private

    def normalize_message(msg)
      case msg
      when Hash
        msg.transform_keys(&:to_s).transform_values { |value| value }
      else
        { message: msg.to_s }
      end
    end
  end
end
