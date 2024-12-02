<script setup>
import {ref} from 'vue'
import { MessageSquare,Ticket,TicketPlus,UserCheck,Repeat } from 'lucide-vue-next'

let params = new URLSearchParams(window.location.search)
const domain = window.location.hostname;
import avatarFallback from '@/assets/avatar.svg';

let postURL = params.get('post') || "";
let display = ref(false);
let warning = ref('');
let info = ref({});
let participants = ref([]);
let winner = ref(null)
let raffleOptions = ref({})
let optURL = ref('1111')
let copied = ref(false)
if (params.get('opt')){
  //4 digits
  console.log('raffle options');  
  raffleOptions.value.like = 1
  raffleOptions.value.comment = Number(params.get('opt')[1])
  raffleOptions.value.repost = Number(params.get('opt')[2])
  raffleOptions.value.follow = Number(params.get('opt')[3])
  console.log(raffleOptions.value);
  
  
} else {
  raffleOptions.value.like = 1
  raffleOptions.value.comment = 1
  raffleOptions.value.repost = 1
  raffleOptions.value.follow = 1
}

const copy = (t) => {
  navigator.clipboard.writeText(t)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 500);
}

const fetchAll = async (url,tar,cursor=null,arr=[]) => {
        let addCursor = ''
        if(cursor) addCursor='&cursor='+cursor
        return fetch(url + addCursor)
        .then(res => res.json())
        .then(data => {
          
          arr.push(...data[tar])
          info.value.fetchCount += data[tar].length
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

  info.value.embed = await fetch(`https://corsproxy.io/?https://embed.bsky.app/oembed?url=${postURL}`)
  .then(res => res.json())
  .then(data => data.html)
  
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
  
  display.value = true;
  const at_uri = `at://${await info.value.did}/app.bsky.feed.post/${info.value.post}`
  //get comments
  fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${at_uri}&depth=1`)
    .then(res => res.json())
    .then(data => {;
      info.value.replies = data.thread.replies.sort( (a,b) => new Date(b.post.indexedAt).getTime() - new Date(a.post.indexedAt).getTime())
      info.value.replies = info.value.replies.filter((u,i,s) => i === s.findIndex(t=>(
        t.post.author.did === u.post.author.did
      )))
    })
    
  //get followers
  info.value.fetchCount = 0
  warning.value = 'Getting Followers (this can take a while...)'
  info.value.followers = await fetchAll(`https://public.api.bsky.app/xrpc/app.bsky.graph.getFollowers?actor=${info.value.did}&limit=100`,'followers')
  //get likes
  info.value.fetchCount = 0
  warning.value = 'Getting Likes'
  info.value.likes = await fetchAll(`https://public.api.bsky.app/xrpc/app.bsky.feed.getLikes?uri=${at_uri}&limit=100`,'likes')
  //get reposts
  info.value.fetchCount = 0
  warning.value = 'Getting Reposts'
  info.value.reposts = await fetchAll(`https://public.api.bsky.app/xrpc/app.bsky.feed.getRepostedBy?uri=${at_uri}&limit=100`,'repostedBy')
  warning.value = ''
  //make opturl
  let newOpt = '1'
  newOpt += raffleOptions.value.comment 
  newOpt += raffleOptions.value.repost 
  newOpt += raffleOptions.value.follow 
  console.log('opturl =', optURL)
  console.log('newurl =', newOpt)
  optURL.value = newOpt
  
  let bskyEmbed = document.createElement('script')
      bskyEmbed.setAttribute('src', 'https://embed.bsky.app/static/embed.js')
      document.querySelector('.bluesky-embed').insertAdjacentElement('afterend',bskyEmbed)
  getPlayers();
  const observer = new ResizeObserver(entries => {
    for (let entry of entries) {
      const { height } = entry.contentRect;
      // console.log('Height changed:', height); 
      document.querySelector('.partic_container ul').style.cssText  = `max-height: ${height * 0.9}px;margin-bottom:30px`;
    }
  });
  observer.observe(document.querySelector('.embed'));

}

const getPlayers = async() => {
  // filter users
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
    displayName: like.actor.displayName,
    url: `https://bsky.app/profile/${like.actor.handle}`,
    avatar: like.actor.avatar,
    bonus: 0
    }
  })
  let repostUserList = await info.value.reposts.map(repost => {
    return {
    handle: repost.handle,
    did: repost.did,
    }
  })
  let followerUserList = await info.value.followers.map(follower => {
    return {
    handle: follower.handle,
    did: follower.did,
    }
  })

  //need to generate link from comment
  const checkFollow = async (url) => {
    let follow = false;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if(data.relationships[0].followedBy) follow = true
      })
      return follow
  }

  participants.value = likeUserList
  //exclude post author
  participants.value = participants.value.filter(user => user.did != info.value.did)

  if(raffleOptions.value.comment == 1){
    participants.value = participants.value.filter(user => commentUserList.some(e => e.handle == user.handle))
    participants.value = participants.value.map(user => {
      let temp = user
      temp.url = commentUserList.find(e => e.handle == user.handle).url
      return temp
    })
  } else if(raffleOptions.value.comment == 2){
    participants.value = participants.value.map(user => {
      let temp = user
      temp.url = commentUserList.find(e => e.handle == user.handle) ? commentUserList.find(e => e.handle == user.handle).url : user.url
      temp.bonus = commentUserList.find(e => e.handle == user.handle) ? user.bonus + 1 : user.bonus
      return temp
    })
  }
  if(raffleOptions.value.repost == 1){
    participants.value = participants.value.filter(user => repostUserList.some(e => e.handle == user.handle))
  } else if(raffleOptions.value.repost == 2){
    participants.value = participants.value.map(user => {
      let temp = user
      temp.bonus = repostUserList.find(e => e.handle == user.handle) ? user.bonus + 1 : user.bonus
      return temp
    })
  }
  if(raffleOptions.value.follow == 1){
    participants.value = participants.value.filter(user => followerUserList.some(e => e.handle == user.handle))
  } else if(raffleOptions.value.follow == 2){
    participants.value = participants.value.map(user => {
      let temp = user
      temp.bonus = followerUserList.find(e => e.handle == user.handle) ? user.bonus + 1 : user.bonus
      return temp
    })
  }
}
const assignTickets = () => {
  let tickets = [];
  participants.value.forEach(user => {
    for(let i = user.bonus + 1; i > 0; i--){
      tickets.push(user.did)
    }
  })
  console.log(tickets)
  return tickets
}
const getRandom = () => {
  let tickets = assignTickets()
  let winningTicket = tickets[Math.floor(Math.random() * tickets.length)]
  winner.value = participants.value.find(e => e.did == winningTicket)
}

const toggleOpt = (opt) => {
raffleOptions.value[opt]++
raffleOptions.value[opt] = raffleOptions.value[opt] > 2 ? 0 : raffleOptions.value[opt]
getPlayers();
}

const optName = (n) => {
  return n==1 ? 'Required'
  : n==2 ? 'Bonus Ticket'
  : 'Optional'
}
if(postURL !== '') getInfo();
</script>

<template>
  <header>
    <div class="cred">
      <Transition>
        <span v-if="copied" class="share-notification">copied link</span>
      </Transition>
      <span class="share"><a href="#"><img src="@/assets/share.svg" alt="share current post" @click="copy(`http://${domain}?opt=${optURL}&post=${postURL}`)"></a></span>
      <span>by <a href="https://bsky.app/profile/knifoon.com">knifoon</a></span>
    </div>
    <div>
      <input v-model="postURL" placeholder="post url" @keyup.enter="getInfo" class="post-url">
      <br>
      <button @click="toggleOpt('repost')" class="opt-button" :class="{'optional':raffleOptions.repost==0,'req':raffleOptions.repost==1,'bonus':raffleOptions.repost==2}" :title="'Repost: '+optName(raffleOptions.repost)"><Repeat /></button>
      <button @click="toggleOpt('comment')" class="opt-button" :class="{'optional':raffleOptions.comment==0,'req':raffleOptions.comment==1,'bonus':raffleOptions.comment==2}" :title="'Comment: '+optName(raffleOptions.comment)"><MessageSquare /></button>
      <button @click="toggleOpt('follow')" class="opt-button" :class="{'optional':raffleOptions.follow==0,'req':raffleOptions.follow==1,'bonus':raffleOptions.follow==2}" :title="'Follow: '+optName(raffleOptions.follow)"><UserCheck /></button>

    </div>
    <div v-if="display && !warning">
      <button @click="getRandom(participants)">Pick A Winner</button>
    </div>
    <div v-if="winner" class="winner">
      <img :src="`${winner.avatar || avatarFallback}`" alt="">
      <a :href="`${winner.url}`" target="_blank">
        <h1>
          {{ winner.displayName || winner.handle }} 
          <br>
          WINS
        </h1>
      </a>
    </div>
    <div v-if="warning "><h4>{{ warning }} {{ info.fetchCount || '' }}</h4></div>
  </header>
  <div class="container">
    <div v-if="display " class="col embed">
      <div v-html="info.embed"></div>
    </div>
    <div v-if="participants.length > 0" class="col partic_container">
      <h2 style="position: relative;">{{ participants.length }} Participants <span style="font-size: 20px;position: absolute; right: 10px; top: -15px;"><Ticket style="vertical-align: text-bottom; height: 22px;"><title>Total Tickets</title></Ticket> {{ assignTickets().length }}</span></h2>
      <ul>
        <li v-for="participant in participants" class="participant" v-lazy-container="{ selector: 'img' }">
          <img :src="`${participant.avatar || avatarFallback}`" class="avatar" loading="lazy"><a :href="`${participant.url}`" target="_blank">{{ participant.displayName || participant.handle }}</a> <TicketPlus v-for="n in participant.bonus" style="vertical-align: text-top;"><title>Bonus Ticket</title></TicketPlus>
        </li>
      </ul>
    </div>
  </div>

</template>

<style scoped>
header {
  text-align: center;
}
.cred {
  position: absolute;
  top: 10px;
  right: 10px;
}
.share {
  margin-right: 10px;
}
.share img{
  height: 20px;
  opacity: 80%;
}
.share img:hover{
  opacity: 100%;
}
.share-notification {
  margin-right: 10px;
}
.winner {
  margin-top: 5px;
}
.winner img {
  border-radius: 50%;
  height: 100px;
}
.winner h1 {
  background: #fff;
  border-radius: 10px;
  padding: 10px;
  margin: -20px 0 10px 0;
}
.col {
  display: inline-block;
  text-align: left;
}
.embed {
  width: 600px;
  align-self: center;
}
.avatar {
  height: 30px;
  border-radius: 50%;
}
.post-url {
  align-content: center;
  padding: 10px;
  border-radius: 10px;
  border: solid 1px;
  margin-bottom: 10px;
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
  border-radius: 10px;
  padding: 0 5px;
}
.partic_container h2 {
  margin-block-end: 0;
}
.partic_container ul {
  max-height: 500px;
  margin: 0;
  text-align: left;
  overflow-y: scroll;
  padding: 5px;
}
.opt-button{
  background: none;
}
.optional,.optional svg{
  color: #898989 !important;
  stroke: #898989 !important;
}
.bonus,.bonus svg{
  color: gold !important;
  stroke: gold !important;
}
.opt-button svg{
vertical-align: middle;
stroke: #fff;
}
</style>
