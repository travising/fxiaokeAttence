import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'; // travis add for http
import { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } from 'constants';
import { differenceInCalendarDays } from 'date-fns';

const options = [
  {
    value: '1012',
    label: '上海',
    children: [
      {
        value: '1025',
        label: 'A组',
        isLeaf: true
      },
      {
        value: '1026',
        label: 'B组',
        isLeaf: true
      },
      {
        value: '1027',
        label: 'C组',
        isLeaf: true
      },
      {
        value: '1044',
        label: 'N组',
        isLeaf: true
      }
    ]
  },
  {
    value: '1013',
    label: '深圳',
    children: [
      {
        value: '1017',
        label: 'A组',
        isLeaf: true
      },
      {
        value: '1018',
        label: 'B组',
        isLeaf: true
      },
      {
        value: '1019',
        label: 'C组',
        isLeaf: true
      },
      {
        value: '1020',
        label: 'D组',
        isLeaf: true
      },
      {
        value: '1021',
        label: 'E组',
        isLeaf: true
      },
      {
        value: '1022',
        label: 'F组',
        isLeaf: true
      },      
      {
        value: '1023',
        label: 'G组',
        isLeaf: true
      }
    ]
  }
];

interface userInfos {
  id: string;
  department: number;
  name?: string;
  overTimeTotal?: string;
  overTimeDays?: number;
  checkInDays?: number;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  public dateRange = [];
  public dateStart;
  public dateEnd;
  public dateChange;
  public department;
  sortName: string | null = null;
  sortValue: string | null = null;

  public accessToken;
  public corpId;
  public accessTokenCacheTime;
  public userName;
  public overTime = 0;
  public overTimeTotal = 0;
  public overTimeDays = 0;
  public checkInDays = 0;
  public userInfo: userInfos[];
  public userData = [];
  public localData = [];
  
  nzOptions = options;
  values: any[] | null = null;


  constructor(public http: HttpClient, private cd:ChangeDetectorRef) { }

  ngOnInit() {
    this.dateChange = true;
    this.dateRange = [ new Date(), new Date() ];
  }

  getDateRange(result: Date[]) {
    this.dateChange = false;
    this.dateStart = result[0].getTime();
    this.dateEnd = result[1].getTime();
    console.log('getDateRange: ', result);
  }

  getDepartment(values: any): void {
    this.department = parseInt(this.values[this.values.length-1]);
    console.log(this.department);
  }

  getAccessToken() {
    console.log("------getAccessToken------")
    if ((typeof(this.accessToken) == undefined) || (typeof(this.corpId) == undefined) || 
    ((new Date()).getTime() > JSON.parse(localStorage.getItem('accessTokenCacheTime')))) {
      //let config = { headers: { 'Content-Type': 'application/json'}};
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
        // console.log(this.accessToken);
        // console.log(this.corpId);
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
    
    // attenceBody.corpAccessToken = this.accessToken;
    // attenceBody.corpId = this.corpId;
    // attenceBody.startTime = this.dateStart;
    // attenceBody.endTime = this.dateEnd;
    for(var i=0; i<this.userInfo.length; i++) {
      console.log("userList: " + this.userInfo[i].department);
      attenceBody.openUserIds.push(this.userInfo[i].id);
    }
 
    var num = 0;

    this.http.post(attenceUrl,attenceBody).subscribe(response => {
      var postData = JSON.parse(JSON.stringify(response));
      console.log(postData);
      // console.log(response["datas"][0]["userName"]);

      for(var i = 0; i < postData.totalCount; i++) {
        // last checkin or not
        if((i >= 1)&&(Math.floor(((postData.datas[i].checkinsTimeStamp) / 86400000)) 
        == Math.floor((postData.datas[i-1].checkinsTimeStamp) / 86400000))) {
          //last user checkin
          if((i == (postData.totalCount - 1))) {
            var overTimeHour = Math.floor(this.overTimeTotal/1000/60/60);
            var overTimeMin = Math.floor((this.overTimeTotal % 3600000)/60000);
            var overTimeSec = Math.floor((this.overTimeTotal % 60000)/1000);
            this.userData.push({
              id: postData.datas[i].openUserId,
              name: postData.datas[i].userName,
              overTimeTotal: overTimeHour + ":" + overTimeMin + ":" + overTimeSec,
              checkInDays: this.checkInDays,
              overTimeDays: this.overTimeDays
            });
            console.log(this.userData[num].name);
          }
          continue;
        }

        // if last checkin is not "离开" then +2hours
        if(JSON.stringify(postData.datas[i].contentText).indexOf("到达") != -1) {
          this.overTime += 2*60*60*1000000 ;
        }

        if((i >= 1) && (postData.datas[i].openUserId != postData.datas[i-1].openUserId)) {
          var overTimeHour = Math.floor(this.overTimeTotal/1000/60/60);
          var overTimeMin = Math.floor((this.overTimeTotal % 3600000)/60000);
          var overTimeSec = Math.floor((this.overTimeTotal % 60000)/1000);
          this.userData.push({
            id: postData.datas[i-1].openUserId,
            name: postData.datas[i-1].userName,
            overTimeTotal: overTimeHour + ":" + overTimeMin + ":" + overTimeSec,
            checkInDays: this.checkInDays,
            overTimeDays: this.overTimeDays
          });
          console.log(this.userData[num].name);
          this.overTimeTotal = 0;
          this.checkInDays = 0;
          this.overTimeDays = 0;
          num++;
        }

        // overtime ms
        this.overTime = (postData.datas[i].checkinsTimeStamp) % 86400000 - ((19.5-8)*3600000);
        if(this.overTime > 0) {
          this.overTimeTotal += this.overTime;
          this.overTimeDays++;
        } else {
          this.overTime = 0;
        }
        this.checkInDays++;
        //last user
        if((i == (postData.totalCount - 1))) {
          var overTimeHour = Math.floor(this.overTimeTotal/1000/60/60);
          var overTimeMin = Math.floor((this.overTimeTotal % 3600000)/60000);
          var overTimeSec = Math.floor((this.overTimeTotal % 60000)/1000);
          this.userData.push({
            id: postData.datas[i].openUserId,
            name: postData.datas[i].userName,
            overTimeTotal: overTimeHour + ":" + overTimeMin + ":" + overTimeSec,
            checkInDays: this.checkInDays,
            overTimeDays: this.overTimeDays
          });
          console.log(this.userData[num].name);
          // this.userList[num].overTimeTotal = postData.datas[i].overTimeTotal;
        }
      }
      
      const tmp = this;
      this.userData.forEach((data) => {
        let curr = tmp.userInfo.find((info) => {
          return info.id === data.id;
        })
        if (curr) {
          curr.overTimeTotal = data.overTimeTotal;
          curr.checkInDays = data.checkInDays;
          curr.overTimeDays = data.overTimeDays;
        }
      });

      // for(var i=0;i<this.userInfo.length;i++) {
      //   for(var j=0;j<this.userData.length;j++) {
      //     if(this.userInfo[i].id===this.userData[j].id) {
      //       this.userInfo[i].overTimeTotal = this.userData[j].overTimeTotal;
      //       this.userInfo[i].checkInDays = this.userData[j].checkInDays;
      //       this.userInfo[i].overTimeDays = this.userData[j].overTimeDays;
      //     } 
      //   }
      // }
      
      // this.cd.detectChanges();
      console.log(this.userData);
      console.log(this.userInfo);
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
    
    // attenceBody.corpAccessToken = this.accessToken;
    // attenceBody.corpId = this.corpId;
    // attenceBody.departmentId = this.department;

    console.log(attenceBody);

    this.http.post(attenceUrl,attenceBody).subscribe(response => {
      var postData = JSON.parse(JSON.stringify(response));
      console.log(postData);
      for(var i = 0; i < postData.userList.length; i++) {
        if(postData.userList[i].isStop == false) {
          this.userInfo.push({
            id: postData.userList[i].openUserId,
            department: postData.userList[i].attachingDepartmentIds[0],
            name: postData.userList[i].name
          });
        }
      }
      this.getAttenceData();
    });
  }

  getDepartments() {
    this.getAccessToken();
    let attenceUrl = 'https://open.fxiaoke.com/cgi/department/list';
    let attenceBody = {
      "corpAccessToken": this.accessToken, 
      "corpId": this.corpId, 
    };
    
    this.http.post(attenceUrl,attenceBody).subscribe(response => {
      console.log(response);
    });
  }
  
  getData() {
    this.userData=[];
    this.userInfo = [];
    this.getAccessToken();
  }

  /*Data Sort*/
  /*
  userInfoDisplay: Array<{ id: string; department: number; name: string; overTimeTotal: string; overTimeDays: number; checkInDays: number; [key: string]: string | number }> = [
    ...this.userInfo
  ];
  */
  userInfoDisplay: userInfos[];

  sort(sort: { key: string; value: string }): void {
    console.log(sort);
    this.sortName = sort.key;
    this.sortValue = sort.value;
    this.search();
  }

  search(): void {
    /** sort data **/
    console.log(this.sortName);
    if (this.sortName && this.sortValue) {
      if (this.sortName === 'overTimeTotal') {
        console.log(this.userInfo[0].overTimeTotal);
        this.userInfoDisplay = this.userInfo.sort((a, b) =>
          this.sortValue === 'ascend' ? (a[this.sortName!] > b[this.sortName!] ? 1 : -1) : (b[this.sortName!] > a[this.sortName!] ? 1 : -1)
        );
        console.log(this.userInfoDisplay);
      }
      else {
        this.userInfoDisplay = this.userInfo.sort((a, b) =>
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
      this.userInfoDisplay = this.userInfo;
    }
  }

  disabledDate = (current: Date): boolean => {
    // Can not select days before today and today
    return differenceInCalendarDays(current, new Date()) > 0;
  };
}
