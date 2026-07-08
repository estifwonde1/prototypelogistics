# frozen_string_literal: true

module Cats
  module Warehouse
    # Places stacks whose footprint falls outside the store floor back inside with clearance gaps.
    class StackFloorRepositioner
      WALL_CLEARANCE = 1.0
      STACK_GAP = 1.0

      class << self
        def footprint_inside_store?(stack, store)
          return false unless stack.start_x.present? && stack.start_y.present?

          sx = stack.start_x.to_f
          sy = stack.start_y.to_f
          sl = stack.length.to_f
          sw = stack.width.to_f
          return false unless sl.positive? && sw.positive?

          max_x = store.length.to_f
          max_y = store.width.to_f
          sx >= WALL_CLEARANCE - 0.001 &&
            sy >= WALL_CLEARANCE - 0.001 &&
            (sx + sl) <= (max_x - WALL_CLEARANCE + 0.001) &&
            (sy + sw) <= (max_y - WALL_CLEARANCE + 0.001)
        end

        def fix_store!(store)
          outside = store.stacks.order(:id).select { |s| !footprint_inside_store?(s, store) }
          return 0 if outside.empty?

          skip_ids = outside.map(&:id)
          repositioned = 0

          outside.each do |stack|
            length, width, place = find_place_for_stack(store, stack, skip_ids)
            unless place
              Rails.logger.warn(
                "[StackFloorRepositioner] No slot for stack #{stack.code} in store #{store.code}"
              )
              next
            end

            stack.update_columns(
              start_x: place[:x],
              start_y: place[:y],
              length: length,
              width: width,
              updated_at: Time.current
            )
            skip_ids.delete(stack.id)
            repositioned += 1
          end
          repositioned
        end

        def fix_all!
          total = 0
          Store.find_each { |store| total += fix_store!(store) }
          total
        end

        private

        def find_place_for_stack(store, stack, skip_ids)
          length, width = fit_footprint_to_store(stack, store)
          place = next_slot(store, length, width, skip_stack_ids: skip_ids)
          return [length, width, place] if place

          min_side = 2.0
          shrunk_l = length
          shrunk_w = width
          20.times do
            shrunk_l = [shrunk_l * 0.85, min_side].max.round(2)
            shrunk_w = [shrunk_w * 0.85, min_side].max.round(2)
            place = next_slot(store, shrunk_l, shrunk_w, skip_stack_ids: skip_ids)
            return [shrunk_l, shrunk_w, place] if place
          end

          [length, width, nil]
        end

        def fit_footprint_to_store(stack, store)
          max_l = store.length.to_f - (2 * WALL_CLEARANCE)
          max_w = store.width.to_f - (2 * WALL_CLEARANCE)
          length = [stack.length.to_f, max_l].min
          width = [stack.width.to_f, max_w].min
          [length.round(2), width.round(2)]
        end

        def next_slot(store, length, width, skip_stack_ids: [])
          max_x = store.length.to_f - WALL_CLEARANCE
          max_y = store.width.to_f - WALL_CLEARANCE
          return nil if length > (max_x - WALL_CLEARANCE) || width > (max_y - WALL_CLEARANCE)

          y = WALL_CLEARANCE

          while y + width <= max_y + 0.001
            x = WALL_CLEARANCE
            while x + length <= max_x + 0.001
              candidate = { x: x.round(2), y: y.round(2) }
              unless overlaps_existing?(store, candidate, length, width, skip_stack_ids: skip_stack_ids)
                return candidate
              end

              x += length + STACK_GAP
            end
            y += width + STACK_GAP
          end

          nil
        end

        def overlaps_existing?(store, candidate, length, width, skip_stack_ids: [])
          store.stacks.find_each do |other|
            next if skip_stack_ids.include?(other.id)
            next unless other.start_x.present? && other.start_y.present?
            next unless footprint_inside_store?(other, store)

            if rectangles_overlap?(
              candidate[:x], candidate[:y], length, width,
              other.start_x.to_f, other.start_y.to_f, other.length.to_f, other.width.to_f
            )
              return true
            end
          end
          false
        end

        def rectangles_overlap?(ax, ay, al, aw, bx, by, bl, bw)
          eps = 1.0e-4
          ax < bx + bl - eps && bx < ax + al - eps && ay < by + bw - eps && by < ay + aw - eps
        end
      end
    end
  end
end
