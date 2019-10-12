import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'; // travis add for http
import { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } from 'constants';
import { differenceInCalendarDays, getTime } from 'date-fns';
import { resolve } from 'path';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { NzMessageService } from 'ng-zorro-antd/message';

interface userInfos {
  id?: string;
  group: string;
  name?: string;
  overTimeTotal?: string;
  overTimeDays?: number;
  workingTime?: string;
  checkInDays?: number;
}

interface groupInfos {
  name: string;
  group: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  public preDate = new Date(new Date().getTime() - 30*24*60*60*1000);
  public dateRange = [];
  public dateStart;
  public dateEnd;
  public dateChange;
  public department = 1012;
  public groups;
  sortName: string | null = null;
  sortValue: string | null = null;
  listOfGroup = [{ text: 'A组', value: 'A组' }, { text: 'B组', value: 'B组' }, { text: 'C组', value: 'C组' }, { text: 'N组', value: 'N组' }];
  listOfGroupFilter:string[]=[];
  public accessToken;
  public corpId;
  public accessTokenCacheTime;
  public userName;
  public overTime = 0;
  public overTimeTotal = 0;
  public overTimeDays = 0;
  public workingTime = 0;
  public checkInDays = 0;
  public userInfo: userInfos[];
  public userInfoDisplay: userInfos[];
  public groupInfo: groupInfos[] = [];
  public userData = [];
  public localData;
  public testData = [];
  public dataShow = false;
  public isSpinning;
 
  constructor(public http: HttpClient, private cd:ChangeDetectorRef, private message: NzMessageService) { }

  ngOnInit() {
    this.dateStart = this.preDate.getTime();
    this.dateEnd = new Date().getTime();
    this.dateRange = [ this.preDate, new Date() ];
    let that = this;

    new Promise(function (resolve,reject){
      that.http.get('assets/userData.json').subscribe(data => {
        resolve(data);
      });     
    }).then(function(data){
      console.log(data);
      that.localData = data;
      for(var i in that.localData){
        console.log(i + ":" + that.localData[i].group);
        for(var j in that.localData[i].user) {
          that.groupInfo.push({
            name: that.localData[i].user[j],
            group: that.localData[i].group
          });
        }
      }
    });   
  }

  getDateRange(result: Date[]) {
    this.dateChange = false;
    this.dateStart = result[0].getTime() - result[0].getTime()%(24*60*60*1000);
    this.dateEnd = result[1].getTime() - result[1].getTime()%(24*60*60*1000) + 24*3600000;
    console.log('this.dateStart: ', this.dateStart, new Date(this.dateStart));
    console.log('this.dateEnd: ', this.dateEnd, new Date(this.dateEnd));
  }

  getAccessToken() {
    console.log("------getAccessToken------")
    if ((typeof(this.accessToken) == undefined) || (typeof(this.corpId) == undefined) || 
    ((new Date()).getTime() > JSON.parse(localStorage.getItem('accessTokenCacheTime')))) {
      let accessTokenUrl = 'https://open.fxiaoke.com/cgi/corpAccessToken/get/V2';
      let accessTokenBody = { 
        "appId": "FSAID_1318604",
        "appSecret": "7da992b7115f42418aec1a17cd69e7e2",
        "permanentCode": "2F47EFA6CC5BE749A522722C741DB6B8"
      };

      this.http.post(accessTokenUrl,accessTokenBody).subscribe(response => {
        console.log(response);
        this.accessToken = JSON.parse(JSON.stringify(response)).corpAccessToken;
        this.corpId = JSON.parse(JSON.stringify(response)).corpId;
        this.accessTokenCacheTime = (JSON.parse(JSON.stringify(response)).expiresIn)*1000 + (new Date()).getTime();
        localStorage.setItem('accessTokenTemp', JSON.stringify(this.accessToken));
        localStorage.setItem('corpId', JSON.stringify(this.corpId));
        localStorage.setItem('accessTokenCacheTime', JSON.stringify(this.accessTokenCacheTime));
        this.getUserList();
      });
    } else {
      this.accessToken = JSON.parse(localStorage.getItem('accessTokenTemp'));
      this.corpId = JSON.parse(localStorage.getItem('corpId'));
      console.log(this.accessToken);
      console.log(this.corpId);
      this.getUserList();
    }
  }

  getAttenceData() {
    console.log("------getAttenceData------")

    this.overTime = 0;
    this.overTimeTotal = 0;
    this.workingTime = 0;
    this.overTimeDays = 0;
    this.checkInDays = 0;

    let attenceUrl = 'https://open.fxiaoke.com/cgi/outsideAttendance/find';
    let attenceBody = {
      "corpAccessToken": this.accessToken, 
      "corpId": this.corpId, 
      "startTime": this.dateStart, 
      "endTime": this.dateEnd, 
      "pageSize": 1000,
      "pageNumber": 1,
      "openUserIds": []
    };
    
    for(var i=0; i<this.userInfo.length; i++) {
      attenceBody.openUserIds.push(this.userInfo[i].id);
    }

    var num = 0;
    this.http.post(attenceUrl,attenceBody).subscribe(response => {
      var postData = JSON.parse(JSON.stringify(response));
      console.log(postData);
      for(var i = 0; i < postData.totalCount; i++) {
        // someone last checkin in a day
        var curr = i;
        while((i < postData.totalCount-1 )&&(postData.datas[i].openUserId === postData.datas[i+1].openUserId)
          &&(Math.floor(((postData.datas[i].checkinsTimeStamp) / 86400000)) === Math.floor((postData.datas[i+1].checkinsTimeStamp) / 86400000))) {
            i++;
        }

        // if last checkin is "到达" then +2hours
        var addTime=0;
        if(JSON.stringify(postData.datas[curr].contentText).indexOf("到达") != -1) {
          addTime = 2*60*60*1000 ;
        } 

        // overtime >19:30
        this.overTime = (postData.datas[curr].checkinsTimeStamp) % 86400000 + addTime - ((19.5-8)*3600000);
        if(this.overTime > 0) {
          this.overTime += 1.5 * 3600000;
          this.overTimeTotal += this.overTime;
          this.overTimeDays++;
        } else {
          this.overTime = 0;
        }
        this.checkInDays++;
        this.workingTime += (18-9)*3600000 + this.overTime;

        // someone totaltime these days
        if(((i < postData.totalCount-1)&&(postData.datas[curr].openUserId != postData.datas[i+1].openUserId))||(i===postData.totalCount - 1)) {
          // console.log(response["datas"][curr]["userName"]);
          var overTimeHour = Math.floor(this.overTimeTotal/1000/60/60);
          var overTimeMin = Math.floor((this.overTimeTotal % 3600000)/60000);
          var overTimeSec = Math.floor((this.overTimeTotal % 60000)/1000);
          var workingTimeHour = Math.floor(this.workingTime/1000/60/60);
          var workingTimeMin = Math.floor((this.workingTime % 3600000)/60000);
          var workingTimeSec = Math.floor((this.workingTime % 60000)/1000);
          this.userData.push({
            id: postData.datas[curr].openUserId,
            name: postData.datas[curr].userName,
            workingTime: workingTimeHour + ":" + workingTimeMin + ":" + workingTimeSec,
            overTimeTotal: overTimeHour + ":" + overTimeMin + ":" + overTimeSec,
            checkInDays: this.checkInDays,
            overTimeDays: this.overTimeDays
          });
          // console.log(this.userData[num].name);
          this.overTimeTotal = 0;
          this.workingTime = 0;
          this.checkInDays = 0;
          this.overTimeDays = 0;
          num++;
        }
      }
      
      const tmp = this;
      this.userData.forEach((data) => {
        let curr = tmp.userInfo.find((info) => {
          return info.id === data.id;
        })
        if (curr) {
          curr.overTimeTotal = data.overTimeTotal;
          curr.workingTime = data.workingTime;
          curr.checkInDays = data.checkInDays;
          curr.overTimeDays = data.overTimeDays;
        }
      });
      this.dataShow = true;
      console.log(this.userInfo);
      this.userInfoDisplay = this.userInfo; // travis
      this.isSpinning = false;
    });
  }

  getUserList() {
    console.log("------getUserList------")  
    // this.getAccessToken();

    let attenceUrl = 'https://open.fxiaoke.com/cgi/user/list';
    let attenceBody = {
      "corpAccessToken": this.accessToken,
      "corpId": this.corpId,
      "departmentId": this.department,
      "fetchChild": false,
      "showDepartmentIdsDetail": true
    }

    this.http.post(attenceUrl,attenceBody).subscribe(response => {
      var postData = JSON.parse(JSON.stringify(response));
      var cnt=0;
      for(var i = 0; i < postData.userList.length; i++) {
        if(postData.userList[i].isStop == false) {
          let curr = this.groupInfo.find((info) => {
            return postData.userList[i].name.indexOf(info.name) > -1;
          })
          if(curr) {
            this.userInfo.push({
              id: postData.userList[i].openUserId,
              group: curr.group,
              name: postData.userList[i].name
            });
            cnt++;
          }
        }
      }
      this.getAttenceData();
    });
  }
  
  getData() {
    if(this.dateEnd - this.dateStart > 40*24*3600000){
      this.message.create('error', '起止日期跨度不能超过40天！');
      return;
    }
    this.isSpinning = true;
    this.dataShow = false;
    this.userData=[];
    this.userInfo = [];
    this.getAccessToken();
  }

  saveData() {
    
  }

  /*Data Sort*/
  // userInfoDisplay: userInfos[...this.userInfo];

  sort(sort: { key: string; value: string }): void {
    console.log(sort);
    this.sortName = sort.key;
    this.sortValue = sort.value;
    this.search();    
  }

  filter(listOfGroupFilter: string[]): void {
    console.log(listOfGroupFilter);
    this.listOfGroupFilter = listOfGroupFilter;
    this.search();
  }

  search(): void {
    /** filter data **/
    const filterFunc = (item: userInfos) =>
      (this.listOfGroupFilter.length ? this.listOfGroupFilter.some(group=>item.group.indexOf(group)!== -1): true);

    var filterData = this.userInfo.filter(item => filterFunc(item));
    // console.log(filterData);
    

    /** sort data **/
    if (this.sortName && this.sortValue) {
      if ((this.sortName === 'overTimeTotal')||(this.sortName === 'workingTime')) {    
        let test = this; 
        this.userInfoDisplay = filterData.sort((a, b) =>
          test.sortValue === 'ascend' 
            ? (test.toTimestamp(a[test.sortName!]) > test.toTimestamp(b[test.sortName!]) 
              ? 1 : -1) 
            : (test.toTimestamp(b[test.sortName!]) > test.toTimestamp(a[test.sortName!]) 
              ? 1 : -1)
        );
      } else {
        this.userInfoDisplay = filterData.sort((a, b) =>
          this.sortValue === 'ascend'
            ? a[this.sortName!] > b[this.sortName!]
              ? 1
              : -1
            : b[this.sortName!] > a[this.sortName!]
            ? 1
            : -1
        );
      }
    } else {
      this.userInfoDisplay = filterData;
    }
  }

  disabledDate = (current: Date): boolean => {
    // Can not select days before today and today
    return differenceInCalendarDays(current, new Date()) > 0;
  };

  // time to timestamp
  toTimestamp(time) {
    var timestamp = 0;
    if(time != undefined)
      timestamp = parseInt(time.split(":")[0])*60*60 + parseInt(time.split(":")[1])*60 + parseInt(time.split(":")[2]);
    return timestamp;
  }
}
