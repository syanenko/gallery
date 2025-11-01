// TODO
// - Total cleanup on getting back to menu
// - Set FlatShading in userData
// - Set position (y,z), GUI ranges, env. in userData (?)
// - Set FlatShading in userData
// - Ring as here: C:\xampp\htdocs\jview\main.js 
//
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AsyncLoader } from './modules/AsyncLoader.js';
import { InteractiveGroup } from './modules/interactive/InteractiveGroup.js';
import { HTMLMesh } from './modules/interactive/HTMLMesh.js';
import { GUI } from './node_modules/lil-gui/dist/lil-gui.esm.min.js';
import { XRControllerModelFactory } from './modules/webxr/XRControllerModelFactory.js';
import { VRButton } from './modules/webxr/VRButton.js';

const MODEL_PATH = './data/models/';
const MATERIALS_PATH = './data/materials/';
const ENV_PATH = './data/textures/';

let container;
let camera, cpmatrix, scene, renderer;
let cpos = new THREE.Vector3();
let crot = new THREE.Quaternion();

const FOV = 50;
let textureLoader;
let gui, gui_mesh;
let param_changed = false;

let beam;
const beam_color = 0xffffff;
const beam_hilight_color = 0x222222;

// Orbit controls
let controls;

// XR controller
let controller;
const rotTH = 0.005;
const rotK = 3;
let rotX, rotY;
let rotate = false;

let model;
const modpos = {"x":0, "y":-0.5, "z":-2 };
let animate = [];

const help = true;

// GUI
let params = {
  scale: 1.5,
  x:     0,
  y:     0,
  z:     0,
  rx:    0,
  ry:    0,
  rz:    0,
  anx: false,
  any: false,
  anz: false,
  switch_any: function() { params.any = !params.any;
                           let color = params.any ? "#00ff00" : "#ff9127";
                           gui.controllers[1].$name.style.color = color;
                           param_changed = true; },
  speed: -0.003 }

// View scene
function viewModel(name, env_name, rotate) {
  name += '.glb';
  camera = new THREE.PerspectiveCamera( FOV, window.innerWidth / window.innerHeight, 0.1, 1100 );
  camera.position.set( modpos.x, -modpos.y, -modpos.z);

  scene = new THREE.Scene();
  scene.add( camera );

  // Environmant
  if(env_name) {
    env_name = ENV_PATH + env_name + "/";
    const env = new THREE.CubeTextureLoader().load([
      env_name + "px.jpg",
      env_name + "nx.jpg",
      env_name + "py.jpg",
      env_name + "ny.jpg",
      env_name + "pz.jpg",
      env_name + "nz.jpg",
    ]);

    env.colorSpace = THREE.SRGBColorSpace;
    scene.background = env;
    scene.backgroundIntensity = 0.4;
  }
  // scene.background = new THREE.Color().setRGB( 0.5, 0.5, 0 );

  renderer = new THREE.WebGLRenderer({ antialias: true, maxSamples: 4, alpha: true });
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setAnimationLoop( render );
  
  // XR
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType( 'local' );
  renderer.xr.setFramebufferScaleFactor( 4.0 );

  renderer.xr.addEventListener( 'sessionstart', function ( event ) {
    cpmatrix = camera.projectionMatrix.clone();
    cpos.copy(camera.position);
    crot.copy(camera.quaternion);

    renderer.setClearColor(new THREE.Color(0x000), 1);
    gui.open();
    onReset();
    // gui_mesh.visible = true;
  });

  renderer.xr.addEventListener( 'sessionend', function ( event ) {
    camera.projectionMatrix.copy(cpmatrix);
    camera.position.copy(cpos);
    camera.quaternion.copy(crot);
    camera.fov = FOV;

    renderer.setClearColor(new THREE.Color(0x000), 0);
    // gui_mesh.visible = false;
    onReset();
  });

  container = document.getElementById("container");
  container.appendChild( renderer.domElement );

  // Loader
  textureLoader = new THREE.TextureLoader();

  initControls();
  initGUI();  
  initController();
  loadModel(name);

  // Hilight controller
  const light = new THREE.PointLight( 0xffffff, 1.5, 0, 0);
  light.position.set( 40, 50, 20 );
  scene.add( light );

  let vrb = VRButton.createButton( renderer );
  //vrb.style.setProperty('position', 'absolute');
  //vrb.style.setProperty('top', '10px');
  document.body.appendChild( vrb );
 
  if(rotate)
    params.switch_any();

  // displayAxis(true);
}
window.viewModel = viewModel;

// Load model
export async function loadModel(name)
{
  model = (await AsyncLoader.loadGLTFAsync(MODEL_PATH + name)).scene;
  // console.log(model.userData);

  await renderer.compileAsync( model, camera, scene );
  model.name='model';
  let flat = false;
  if(model.userData.flat)
    flat = true;

  // Normalize model's scale
  let bb = new THREE.Box3();
  let bs = new THREE.Sphere();

  let mcount = 0, vcount = 0; // Stat
  model.traverse(function(node) {
      if (node instanceof THREE.Mesh) {
        bb.expandByObject(node);

        // Matcap
        if(node.userData.matcap != undefined) {
          if(node.material) {
            if(node.material.matcap) {
              node.material.matcap.dispose();
            }
            node.material.dispose();
          } 
          const tl = new THREE.TextureLoader();
          const mc = tl.load(MATERIALS_PATH + node.userData.matcap + ".png");
          mc.colorSpace = THREE.SRGBColorSpace;
          node.material = new THREE.MeshMatcapMaterial( {matcap: mc, side: THREE.FrontSide } );
          node.material.needsUpdate = true;
        }

        node.material.flatShading = flat;
        node.material.needsUpdate = flat;

        if(node.userData.animate != undefined)
          animate.push(node);
        
        mcount++; // Stat
        vcount += Math.floor(node.geometry.attributes.position.count);

      } else if (node instanceof THREE.Light) {
        if(node.target) {
          node.target.position.set(0,0,0);
          scene.add(node.target);
        }
        // scene.add( new THREE.DirectionalLightHelper( node, 5 ) ); // DEBUG
      }
  });

  bb.getBoundingSphere(bs);
  const s = 1 / bs.radius;
  model.scale.set(s, s, s);
  scene.add( model );

  // Stat
  let stat = document.getElementById("stat");
  vcount = new Intl.NumberFormat('no-NO', {
    useGrouping: true,
    groupingSeparator: ' '
  }).format(vcount);

  stat.innerHTML = '"' + name + '" / ' + mcount+ " meshe(s) / " + vcount + " points";
  stat.style.display = "block";
}

// Init orbit controlls
function initControls()
{
  controls = new OrbitControls( camera, renderer.domElement );
  controls.target.set( modpos.x, modpos.y, modpos.z );
  controls.enablePan = true;
  controls.enableDamping = false;
}

// Init GUI
function initGUI()
{
  // GUI
  gui = new GUI( {width: 300, title:"Settings", closeFolders:true} ); // Check 'closeFolders' - not working
  //gui.add( params, 'scale', 0.1, 5.0, 0.01 ).name( 'Scale' ).onChange(onScale);
  //gui.add( params, 'x', -500, 500, 0.01 ).name( 'X' ).onChange(onX);
  //gui.add( params, 'y', -1, 1, 0.01 ).name( 'Height' ).onChange(onY);
  //gui.add( params, 'z', -3, -modpos.z, 0.01 ).name( 'Distance' ).onChange(onZ);
  //gui.add( params, 'rx', -Math.PI, Math.PI, 0.01 ).name( 'Rot X' ).onChange( onRotation );
  //gui.add( params, 'ry', -Math.PI, Math.PI, 0.01 ).name( 'Rotate' ).onChange( onRotation );
  //gui.add( params, 'rz', -Math.PI, Math.PI, 0.01 ).name( 'Rot Z' ).onChange( onRotation );
  //gui.add( params, 'anx').hide();
  gui.add( params, 'any').hide();
  //gui.add( params, 'anz').hide();
  //gui.add( params, 'switch_anx').name( 'Rotate X' );
  gui.add( params, 'switch_any').name( 'Rotate' );
  //gui.add( params, 'switch_anz').name( 'Rotate Z' );
  gui.add( params, 'speed', -0.008, 0.008, 0.001 ).name( 'Speed' ).onChange( ()=>{param_changed = true;} );
  gui.add( gui.reset(), 'reset' ).name( 'Reset' ).onChange(onReset); onReset();

  const group = new InteractiveGroup( renderer, camera );
  scene.add( group );

  // GUI mesh
  /*
  gui_mesh = new HTMLMesh( gui.domElement );
  gui_mesh.rotation.x = -Math.PI / 9;
  gui_mesh.position.y = -0.36;
  gui_mesh.position.z = -0.6;
  
  group.add( gui_mesh );
  gui_mesh.visible = false;
  */

  // params.switch_any(); // By default
  gui.close(); // Collapse by default
}

//
// Display axis
//
let arrow_helper_x;
let arrow_helper_y;
let arrow_helper_z;
let axis_o = new THREE.Vector3(0,0,0);
let axis_x = new THREE.Vector3(1,0,0);
let axis_y = new THREE.Vector3(0,1,0);
let axis_z = new THREE.Vector3(0,0,1);
let axis_len = 10;

async function displayAxis(checked) {
  if(checked) {
    arrow_helper_x = new THREE.ArrowHelper(axis_x, axis_o, axis_len, 'crimson');
    arrow_helper_y = new THREE.ArrowHelper(axis_y, axis_o, axis_len, 'green');
    arrow_helper_z = new THREE.ArrowHelper(axis_z, axis_o, axis_len, 'royalblue');
    scene.add( arrow_helper_x );
    scene.add( arrow_helper_y );
    scene.add( arrow_helper_z );
  }
  else {
   if(arrow_helper_x) {
    scene.remove( arrow_helper_x );
    arrow_helper_x.dispose(); }

   if(arrow_helper_y) {
    scene.remove( arrow_helper_y );
    arrow_helper_y.dispose(); }

   if(arrow_helper_z) {
    scene.remove( arrow_helper_z );
    arrow_helper_z.dispose(); }
  }
}


// Init controller
function initController()
{
  controller = renderer.xr.getController( 0 );

  // Grip 
  const controllerModelFactory = new XRControllerModelFactory();
  const controllerGrip1 = renderer.xr.getControllerGrip( 0 );
  controllerGrip1.add( controllerModelFactory.createControllerModel( controllerGrip1 ) );
  scene.add( controllerGrip1 );

  // Beam
  const beam_geom = new THREE.CylinderGeometry( 0.003, 0.005, 1, 4, 1, true);
  const alpha = textureLoader.load('data/textures/beam_alpha.png');
  const beam_mat = new THREE.MeshStandardMaterial({ transparent: true,
                                                    alphaMap:alpha,
                                                    lightMapIntensity:0,
                                                    opacity: 0.8,
                                                    color: beam_color,
                                                    // emissive: 0xffffff
                                                    alphaTest:0.01
                                                    });
  beam = new THREE.Mesh(beam_geom, beam_mat);
  beam.name = 'beam';
  beam.receiveShadow = false;

  // Alight beam to grip
  beam.rotateX(Math.PI / 2);
  beam.translateY(-0.5);
  controller.add(beam);
  scene.add( controller );

  controller.addEventListener( 'selectstart', onSelectStart );
  controller.addEventListener( 'selectend', onSelectEnd );

  window.addEventListener( 'resize', onWindowResize );
}

//
//  Controller events
//
function onSelectStart( event )
{
  // Hilight beam
  const controller = event.target;
  let beam = controller.getObjectByName( 'beam' );
  beam.material.color.set(beam_hilight_color);
  beam.material.emissive.g = 0.5;

  param_changed = false;

  rotX = controller.rotation.x;
  rotY = controller.rotation.y;
  rotate = true;
}

function onSelectEnd( event )
{
  // Dehilight beam
  const controller = event.target;
  beam = controller.getObjectByName( 'beam' );
  beam.material.color.set(beam_color);
  beam.material.emissive.g = 0;

  if(param_changed) {
    param_changed = false;
    return;
  }

  // gui_mesh.visible = !gui_mesh.visible; // DEBUG
  rotate = false;
}

//
// GUI changes
//
function onScale() {
  if (typeof model == "undefined") { return; }
  model.scale.setScalar( params.scale );
  param_changed = true;
}

function onX() {
  if (typeof model != "undefined") {
    model.position.setX( params.x );
    param_changed = true;
  }
}

function onY() {
  if (typeof model != "undefined") {
    model.position.setY( params.y );
    //controls.target.set( model.position.x, model.position.y, model.position.z );
    param_changed = true;
  }
}

function onZ() {
  if (typeof model != "undefined") {
    console.log(params.z);
    model.position.setZ( params.z );
    //controls.target.set( model.position.x, model.position.y, model.position.z );
    param_changed = true;
  }
}

function onRotation()
{
  if (typeof model == "undefined") { return; }
  const euler = new THREE.Euler( params.rx, params.ry, params.rz, 'XYZ' );
  model.setRotationFromEuler(euler);
  param_changed = true;
}

function onReset()
{
  controls.reset();

  if(renderer.xr.isPresenting) {
    params.x = modpos.x;
    params.y = modpos.y;
    params.z = modpos.z;
  } else {
    params.x = 0;
    params.y = 0;
    params.z = 0;
  }

  for (var i in gui.controllers) {
    gui.controllers[i].updateDisplay();
  }

  if(model) {
    model.position.set(params.x, params.y, params.z);
    controls.target.set( model.position.x, model.position.y, model.position.z );
  }

  // Y-rotation
  // params.any = false;
  gui.controllers[1].$name.style.color = "#ff9127";
  gui.controllers[3].$name.style.color = "#ff9127";

  if (model) {
    const euler = new THREE.Euler( 0, 0, 0, 'XYZ' );
    model.setRotationFromEuler(euler);
  }
}

// Resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}

// Render
function render() {
  if (typeof model == "undefined") { return; }
  controls.update();

  // Rotate whole model
  if (params.anx) {
    model.rotateX(params.speed);
  }

  if (params.any) {
    model.rotateY(params.speed);
  }

  if (params.anz) {
    model.rotateZ(params.speed);
  }

  // XR - rotation
  if(rotate) {
    let dX = (rotX - controller.rotation.x) * rotK;
    let dY = (rotY - controller.rotation.y) * rotK;

    if(Math.abs(dX) > rotTH) {
      model.rotation.x += dX;
      rotX = controller.rotation.x;
    }

    if(Math.abs(dY) > rotTH) {
      model.rotation.y += dY;
      rotY = controller.rotation.y;
    }
  }

  // XR - set model position
  const session = renderer.xr.getSession();
  if (session) {
    const inputSources = session.inputSources;
    inputSources.forEach((source) => {
      if (source.gamepad) {
        const gamepad = source.gamepad;
        if (gamepad.axes.length > 1) {
          if (Math.abs(gamepad.axes[1]) > 0) {
            model.position.z = (params.z) - ((params.z) * gamepad.axes[1] );
          }
        }
      }
    });
  }

  // Animate model
  for(let i=0; i<animate.length; i++) {
    animate[i].rotation.z += parseFloat(animate[i].userData.animate.rotate.z);
    animate[i].rotation.z %= (2 * Math.PI);
  }

  renderer.render( scene, camera );
}
