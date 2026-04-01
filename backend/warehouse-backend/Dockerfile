# Use official Ruby image
FROM ruby:3.2

# Install dependencies
RUN apt-get update -qq && apt-get install -y \
  build-essential \
  curl \
  libpq-dev \
  nodejs \
  postgresql-client \
  && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

ENV RAILS_LOG_TO_STDOUT=true

# Copy engine first (needed for bundle install)
COPY engines ./engines

# Copy Gemfile and Gemfile.lock
COPY Gemfile Gemfile.lock ./

# Install gems
RUN bundle install

# Copy the rest of the application
COPY . .

# Expose port 3000
EXPOSE 3000

# Create entrypoint script
COPY docker-entrypoint.sh /usr/bin/
RUN chmod +x /usr/bin/docker-entrypoint.sh && \
  sed -i 's/\r$//' /usr/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]

# Start the Rails server
CMD ["rails", "server", "-b", "0.0.0.0"]
