<script setup>
import {ref} from 'vue'

let params = new URLSearchParams(window.location.search)
let postURL = params.get('post') || "";
let display = ref(false);
let warning = ref('');
let info = ref({});
let participants = ref([]);
let winner = ref(null)


const fetchAll = async (url,tar,cursor=null,arr=[]) => {
        let addCursor = ''
        if(cursor) addCursor='&cursor='+cursor
        return fetch(url + addCursor)
        .then(res => res.json())
        .then(data => {
          
          arr.push(...data[tar])
          if(data.cursor){
            cursor = data.cursor || null
            return fetchAll(url,tar,cursor,arr)
          }
          return arr;
        })
      }
const getInfo = async() => {
  //reset
  info.value = {};
  display.value = false
  winner.value = null
  participants.value = [];

  info.value.embed = await fetch(`http://192.168.50.202:49153/https://embed.bsky.app/oembed?url=${postURL}`)
  .then(res => res.json())
  .then(data => data.html)
  
  display.value = true;
  if(!postURL.startsWith('https://bsky.app')) {
    warning.value = 'Not a Bluesky URL'
    return;
  }
  let post = [...postURL.matchAll(/profile\/(.*)\/post\/(.*)/g)];
  [info.value.full,info.value.handle,info.value.post] = post[0];
    //get did
    info.value.did = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${info.value.handle}`)
      .then(res => res.json())
      .then(data => {
        info.value.handle = data.handle
        info.value.displayName = data.displayName
        return data.did
      })

  const at_uri = `at://${await info.value.did}/app.bsky.feed.post/${info.value.post}`
  //get comments
  fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${at_uri}&depth=1`)
    .then(res => res.json())
    .then(data => {;
      info.value.replies = data.thread.replies
      console.log('comments=',info.value.replies)
    })
  //get likes
  info.value.likes = await fetchAll(`https://public.api.bsky.app/xrpc/app.bsky.feed.getLikes?uri=${at_uri}&limit=100`,'likes')
  console.log('likes=',info.value.likes);
  //get reposts
  info.value.reposts = await fetchAll(`https://public.api.bsky.app/xrpc/app.bsky.feed.getRepostedBy?uri=${at_uri}&limit=100`,'repostedBy')
  console.log('reposts=',info.value.reposts)
  console.log('done getting info')
  let bskyEmbed = document.createElement('script')
      bskyEmbed.setAttribute('src', 'https://embed.bsky.app/static/embed.js')
      document.querySelector('.bluesky-embed').insertAdjacentElement('afterend',bskyEmbed)
  getPlayers();
}

const getPlayers = async() => {
  console.log('getplayers');
  
  let commentUserList = await info.value.replies.map(comment => {
    return {
      handle: comment.post.author.handle,
      did: comment.post.author.did,
      displayName: comment.post.author.displayName,
      url: `https://bsky.app/profile/${comment.post.author.handle}/post/${comment.post.uri.match(/post\/(.*)/)[1]}`,
      avatar: comment.post.author.avatar
    }
  })
  let likeUserList = await info.value.likes.map(like => {
    return {
    handle: like.actor.handle,
    did: like.actor.did,
    }
  })
  let repostUserList = await info.value.reposts.map(repost => {
    return {
    handle: repost.handle,
    did: repost.did,
    }
  })
  console.log('comment users = ',commentUserList)
  // console.log('likes users = ',likeUserList)
  // console.log('reposts users = ',repostUserList)

  //need to generate link from comment
  const checkFollow = async (url) => {
    let follow = false;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        console.log('relationship = ', data.relationships[0].followedBy)
        if(data.relationships[0].followedBy) follow = true
      })
      return follow
  }
  participants.value = commentUserList.filter(user => likeUserList.some(e => e.handle == user.handle))
  participants.value = participants.value.filter(user => repostUserList.some(e => e.handle == user.handle))
  participants.value = participants.value.filter(async user => await checkFollow(`https://public.api.bsky.app/xrpc/app.bsky.graph.getRelationships?actor=${info.value.did}&others=${user.did}`))
  console.log(participants)
}

const getRandom = (arr) => {
  console.log('picking winner')
  winner.value = arr[Math.floor(Math.random() * arr.length)]
}

if(postURL !== '') getInfo();
</script>

<template>
  <header>
    <input v-model="postURL" placeholder="post url" @change="getInfo" class="post-url">
    <div>
      <button @click="getRandom(participants)">Pick Winner</button>
    </div>
    <h1 v-if="winner" class="winner">Winner is <a :href="`${winner.url}`" target="_blank">{{ winner.handle }}</a></h1>
    <div v-if="warning "><h4>{{ warning }}</h4></div>
  </header>
  <div class="container">
    <div v-if="display && !warning" class="col embed">
      <div v-html="info.embed"></div>
    </div>
    <div v-if="participants.length > 1" class="col partic_container">
      <h2>{{ participants.length }} Participants</h2> 
      <ul>
        <li v-for="participant in participants" class="participant">
          <img :src="`${participant.avatar}`" class="avatar"><a :href="`${participant.url}`" target="_blank">{{ participant.displayName || participant.handle }}</a>
        </li>
      </ul>
    </div>
  </div>

</template>

<style scoped>
header {
  text-align: center;
}
.col {
  display: inline-block;
  text-align: left;
}
.embed {
  width: 600px;
}
.avatar {
  height: 30px;
  border-radius: 50%;
}
.post-url {
  align-content: center;
  padding: 10px;
  border-radius: 5px;
  border: solid 1px;
}
.container {
  display: flex;
}
.participant {
  list-style: none;
  padding: 10px;
  align-content: center;
}
.participant img, .participant a {
  vertical-align: middle;
}
.participant a {
  color: #1C4059;
  padding: 5px;
}
.partic_container {
  text-align: center;
  color: #1C4059;
  background: #ddd;
  border-radius: 5px;
  padding: 0 5px;
}
.partic_container h2 {
  margin-block-end: 0;
}
.partic_container ul {
  margin: 0;
  text-align: left;
  max-height: 500px;
  overflow-y: scroll;
  padding: 5px;
}
</style>
