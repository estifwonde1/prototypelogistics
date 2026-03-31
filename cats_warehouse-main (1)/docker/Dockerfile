FROM ruby:3.3.8

# Timezone configuration
RUN echo "Africa/Nairobi" > /etc/timezone
RUN ln -sf /usr/share/zoneinfo/Africa/Nairobi /etc/localtime

RUN apt-get update -qq && apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs postgresql-client cmake
RUN mkdir /opt/app
WORKDIR /opt/app

COPY Gemfile Gemfile.lock ./

RUN bundle config set --local without 'development test'
RUN bundle install --jobs 20 --retry 5

COPY . .

EXPOSE 3000

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
