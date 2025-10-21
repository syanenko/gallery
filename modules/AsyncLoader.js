import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Prevent materials loading - get only geometry
// import { OBJLoader }  from 'three/addons/loaders/OBJLoader.js';
import { OBJLoader }  from './OBJLoader.js';

import { FBXLoader }  from 'three/addons/loaders/FBXLoader.js';
import { STLLoader }  from 'three/addons/loaders/STLLoader.js';
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js"

// Loading progress
const progress = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const progressLabel = document.getElementById('progress-label');
const loadingManager = new THREE.LoadingManager();

loadingManager.onStart = function (url, loaded, total) {
  // console.log('Loading process has started!');
  // Display it on upload button click
  progressContainer.style.display = 'flex';

  progress.value = 0;
  progressLabel.innerHTML = "Parsing...";
};

loadingManager.onProgress = function (url, loaded, total) {
/*
  console.log(`Progress: ${url}
  number of items loaded: ${loaded}
  total number of items: ${total} `);
*/
  progress.value = (loaded / total) * 100;
};

loadingManager.onLoad = function () {
  //console.log('Loading process has been completed!');
  progressContainer.style.display = 'none';
};

loadingManager.onError = function (url) {
  console.error(`Problem loading: ${url}`);
};

// Loading
const AsyncLoader = {};
AsyncLoader.gltfLoader = new GLTFLoader(loadingManager);
AsyncLoader.objLoader  = new OBJLoader(loadingManager);
AsyncLoader.fbxLoader  = new FBXLoader(loadingManager);
AsyncLoader.stlLoader  = new STLLoader(loadingManager);
AsyncLoader.textureLoader = new THREE.TextureLoader();
AsyncLoader.audioLoader   = new THREE.AudioLoader();

const draco = new DRACOLoader()
draco.setDecoderPath("/node_modules/three/examples/jsm/libs/draco/")
AsyncLoader.gltfLoader.setDRACOLoader(draco)

AsyncLoader.loadGLTFAsync = (url) => {
    return new Promise((resolve, reject) => {
        AsyncLoader.gltfLoader.load(url, obj => {
            resolve(obj);
        })
    });
}

AsyncLoader.loadOBJAsync = (url) => {
    return new Promise((resolve, reject) => {
        AsyncLoader.objLoader.load(url, obj => {
            resolve(obj);
        })
    });
}

AsyncLoader.loadFBXAsync = (url) => {
    return new Promise((resolve, reject) => {
        AsyncLoader.fbxLoader.load(url, obj => {
            resolve(obj);
        })
    });
}

AsyncLoader.loadSTLAsync = (url) => {
    return new Promise((resolve, reject) => {
        AsyncLoader.stlLoader.load(url, obj => {
            resolve(obj);
        })
    });
}

AsyncLoader.loadTextureAsync = (url) => {
    return new Promise((resolve, reject) => {
        AsyncLoader.textureLoader.load(url, (tex) => { resolve(tex); }, undefined, ( err ) => { reject( "Error loading texture" ); })
    });
}

AsyncLoader.loadAudioAsync = (url) => {
    return new Promise((resolve, reject) => {
        AsyncLoader.audioLoader.load(url, (buffer) => {
            resolve(buffer);
        });
    })
}

AsyncLoader.loadAll = (promiseArr, element, message) => {
    let count = promiseArr.length;
    let results = [];
    element.innerHTML = `${message}&nbsp;(${promiseArr.length - count}&nbsp;/&nbsp;${promiseArr.length})...`
    return new Promise((resolve, reject) => {
        promiseArr.forEach((promise, i) => {
            promise.then(result => {
                results[i] = result;
                count--;
                element.innerHTML = `${message}&nbsp;(${promiseArr.length - count}&nbsp;/&nbsp;${promiseArr.length})...`
                if (count === 0) {
                    resolve(results);
                }
            })
        })
    });
}
export { AsyncLoader, loadingManager };