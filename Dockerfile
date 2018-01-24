FROM node

COPY . /opt/rna
RUN yarn global add /opt/rna \
    && rm -rf /opt/rna
