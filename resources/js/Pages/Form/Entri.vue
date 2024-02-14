<template>
    <Head title="Dashboard" />

    <!-- <AuthenticatedLayout> -->
        <div>

        <div id="FormGear-loader" class="bg-gray-200  dark:bg-[#181f30] h-screen">

        <div class="overflow-hidden">
            <div class="bg-gray-50 dark:bg-gray-900 dark:text-white h-screen shadow-xl text-gray-600 flex overflow-hidden text-sm font-montserrat rounded-lg  dark:shadow-gray-800">


            <div class=" flex-grow flex flex-col bg-white dark:bg-gray-900 z-0">

                <div class="relative  md:flex max-h-screen  ">
                <div class="block">
                    <div class=" backdrop-blur-sm col-span-12 overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none flex justify-center items-center">
                    <svg class="w-20 h-20 animate-spin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 94.53 98.372"><circle cx="23.536" cy="16.331" r="8.646" style="fill:#0a77e8"/><circle cx="8.646" cy="36.698" r="8.646" style="fill:#0f9af0"/><circle cx="8.646" cy="61.867" r="8.646" style="fill:#0f9af0"/><circle cx="23.536" cy="82.233" r="8.646" style="fill:#13bdf7"/><circle cx="47.361" cy="89.726" r="8.646" style="fill:#13bdf7"/><circle cx="71.282" cy="82.233" r="8.646" style="fill:#18e0ff"/><circle cx="85.884" cy="61.867" r="8.646" style="fill:#65eaff"/><circle cx="85.884" cy="36.698" r="8.646" style="fill:#b2f5ff"/><circle cx="47.361" cy="8.646" r="8.646" style="fill:#1d4970"/></svg>
                    </div>
                </div>

                <div
                    class="bg-gray-50 dark:bg-gray-900 w-72 flex-shrink-0  dark:border-gray-800 h-full  p-5 space-y-4
                    absolute inset-y-0 left-0 transform -translate-x-full transition-transform duration-500 ease-in-out md:relative md:translate-x-0 z-10">

                    <div class="animate-pulse flex space-x-4">
                    <div class="flex-1 space-y-3 py-1">
                        <div class="w-full  shadow-2xl rounded-lg">

                        <div class="h-32 bg-gray-200 rounded-tr-lg rounded-tl-lg animate-pulse"></div>

                        <div class="p-5">
                            <div class="h-20 px-2 rounded-lg bg-gray-200 animate-pulse mb-4"></div>
                            <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-10 mb-4"></div>
                            <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-4 mb-4"></div>
                            <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-4 mb-4"></div>

                            <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-10 mb-4"></div>
                            <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-4 mb-4"></div>
                            <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-4 mb-4"></div>

                            <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-10 mb-4"></div>
                            <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-4 mb-4"></div>
                            <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-4 mb-4"></div>

                            <div class="h-20 px-2 rounded-lg bg-gray-200 animate-pulse mt-10 mb-4"></div>
                        </div>

                        </div>
                    </div>
                    </div>

                </div>

                <div class="flex-grow bg-white dark:bg-gray-900 transition duration-500 ease-in-out z-10 p-5 space-y-4
                    ">

                    <div class="flex-grow bg-white dark:bg-gray-900 ">
                    <div class=" w-full mx-auto">
                        <div class="animate-pulse flex space-x-4">
                        <div class="flex-1 space-y-3 py-1">
                            <div
                            class="min-h-screen flex items-start justify-start bg-gradient-to-br from-gray-200 to-gray-400">

                            <div class="w-full bg-white  shadow-2xl rounded-lg">

                                <div class="h-32 bg-gray-200 rounded-tr-lg rounded-tl-lg animate-pulse"></div>

                                <div class="p-5">
                                <div class="h-20 px-2 rounded-lg bg-gray-200 animate-pulse mb-4"></div>
                                <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-10 mb-4"></div>
                                <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-4 mb-4"></div>
                                <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-4 mb-4"></div>

                                <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-10 mb-4"></div>
                                <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-4 mb-4"></div>
                                <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-4 mb-4"></div>

                                <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-10 mb-4"></div>
                                <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-4 mb-4"></div>
                                <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-4 mb-4"></div>

                                <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-10 mb-4"></div>
                                <div class="h-6 rounded-lg bg-gray-200 animate-pulse mt-4 mb-4"></div>
                                </div>

                            </div>

                            </div>

                        </div>
                        </div>
                    </div>
                    </div>

                </div>



                </div>

            </div>
            </div>
        </div>

        </div>


        <div id="FormGear-root">
        </div>

        </div>
    <!-- </AuthenticatedLayout> -->
</template>


<script setup module>
// import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import { Head } from '@inertiajs/vue3';
import { FormGear } from "form-gear"
import "form-gear/dist/style.css"
import reference from "../Data/reference"
import template from "../Data/template"
import preset from "../Data/preset.json"
import response from "../Data/response.json"
import validation from "../Data/validation.json"
import media from "../Data/media.json"
import remark from "../Data/remark.json"
import { computed, toRaw } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { router } from '@inertiajs/vue3'
import Toastify from 'toastify-js'

// toastInfo(error.message, 5000, "", "bg-pink-600/80");


const page = usePage()

const prefill = computed(() => page.props.prefill).value;

const region_id = computed(() => page.props.region_id).value;

const pcl = computed(() => page.props.pcl).value;

const nurt = computed(() => page.props.nurt).value;

const rawPcl = toRaw(pcl)

const rawNurt = toRaw(nurt)

preset['predata'] = prefill[Object.entries(prefill)[0][0]]

template['components'][0][0]['components'][0][8]['options'] = rawPcl

template['components'][0][0]['components'][0][7]['options'] = rawNurt

defineProps({
  region : Object
})



function initForm(reference,  template, preset, response, validation, media, remark){


//variable config
let config = {
  clientMode: 1, // 1 => CAWI ; 2 => CAPI ;
  //both token and baseUrl are used for data lookup from the api (for selectInput, multiselect Input, and listSelectInput)
  token: ``, //for authentication such as bearer token
  baseUrl: ``, // endpoint to fetch
  lookupKey: ``, //optional
  lookupValue: ``, //optional
  lookupMode : 1, // 1 => ONLINE ; 2 => OFFLINE
  username: '', //
  formMode: 1, // 1 => OPEN ; 2 => REJECTED ; 3 => SUBMITTED ; 4 => APPROVED ;
  initialMode: 2 // 1=> INITIAL ; 2 => ASSIGN
}

//some variables initiation
var cameraFunction = null;
var cameraGPSFunction = null;
var responseGear = null;
var mediaGear = null;
var remarkGear = null;
var principalGear = null;
var referenceGear = null;

    let uploadHandler = function (setter) {

    }

    let offlineSearch = function (id, version, dataJson, setter) {

  let condition = JSON.stringify(dataJson)

  //here we use jquery to retrieve data from the local device
  $.ajax({
    url: `http://localhost:9090/lookup?id=${id}&v=${version}&c=${condition}`,//specify localhost endpoint to fetch
    type: "GET",
    crossDomain: true,
    dataType: "json",
    data: null,
    success: function(d) {
        console.log(d.hasil)
        setter(d)

        },
    error: function(XMLHttpRequest, textStatus, errorThrown) {

    }
});

}

    let GpsHandler = function (setter, isPhoto) {
    // console.log('camera handler', setter);
    // isPhoto = true,
    // cameraGPSFunction = setter;
    // openCameraGPS(isPhoto);
    }

        const setBearer = () => {
    return ({
        method: 'GET',
        headers: {
        "Content-Type": "application/json"        }
    })
    }

    //custom function to trigger setResponsMobile to run from outside form-gear, you can custom the function name
let mobileExit = (fun) => {
  // fun()
}

    // pencarian online
//online lookup
let onlineSearch = async (url) =>
(await fetch(url, setBearer())
  .catch((error) => {
    return {
      success: false,
      data: {},
      message: '500'
    }
  }).then((res) => {
    if (res.status === 200) {
      let temp = res.json();
      return temp;
    } else {
      return {
        success: false,
        data: {},
        message: res.status
      }
    }
  }).then((res) => {
    return res;
  }
  ));



//function to get response, remark, principal and reference
let setResponseMobile = function (res, rem, princ, ref) {
        // responseGear = res
        // mediaGear = med
        // remarkGear = rem
        // principalGear = princ
        // referenceGear = ref

        // console.log('----------', new Date(), '----------');

        // console.log('response', responseGear)
        // console.log('media', mediaGear)
        // console.log('remark', remarkGear)
        // console.log('principal', principalGear)
        // console.log('reference', referenceGear)
}

let setSubmitMobile = function (res, rem, princ, ref) {
        responseGear = res
        // mediaGear = med
        // remarkGear = rem
        // principalGear = princ
        // referenceGear = ref

        // console.log('----------', new Date(), '----------');

        // console.log('response', responseGear)
        // // console.log('media', mediaGear)
        // console.log('remark', remarkGear)
        // console.log('principal', principalGear)
        // console.log('reference', referenceGear)

        router.visit('/form/store/' + region_id,{
            method: 'post',
            data : responseGear,
            preserveState: false,
            preserveScroll: false,
        })

}


    let openMap = function (koordinat) {
    // koordinat = koordinat

    // console.log('coordinat ', koordinat)
    }

    let form = FormGear(reference, template, preset, response, validation, media, remark, config, uploadHandler, GpsHandler, offlineSearch, onlineSearch, mobileExit, setResponseMobile, setSubmitMobile, openMap);

    return form;
}

const data = Promise.all([
    reference, template, preset, response, validation, media, remark
]);

data.then(([reference, template, preset, response, validation, media, remark]) => initForm(reference, template, preset, response, validation, media, remark));

</script>