<?php
ini_set('display_errors',0); error_reporting(0);
session_start();
header('Content-Type: application/json; charset=UTF-8');

$uploadDir   = __DIR__.'/pdfs/';
$trashDir    = __DIR__.'/trash/';
$historyFile = __DIR__.'/history.log';
if (!is_dir($trashDir)) mkdir($trashDir,0755,true);

// Poda >30 días
function pruneHistory(){
  global $historyFile;
  if(!file_exists($historyFile)) return;
  $keep=[]; $th=strtotime('-30 days');
  foreach(file($historyFile,FILE_IGNORE_NEW_LINES) as $l){
    list($ts)=explode('|',$l,2);
    if(strtotime($ts)>= $th) $keep[]=$l;
  }
  file_put_contents($historyFile,implode("\n",$keep).(count($keep)?"\n":""));
}
pruneHistory();

$act=$_GET['action']??$_POST['action']??'';
switch($act){
  case 'list':         listFiles();      break;
  case 'upload':       uploadFile();     break;
  case 'deleteMultiple': deleteMultiple(); break;
  case 'history':      listHistory();    break;
  default: echo json_encode(['error'=>'Acción no válida']); break;
}

function listFiles(){
  global $uploadDir;
  $out=[];
  foreach(scandir($uploadDir) as $f){
    if(is_file($uploadDir.$f)&&strtolower(pathinfo($f,PATHINFO_EXTENSION))==='pdf'){
      $out[]=['name'=>$f,'url'=>'pdfs/'.rawurlencode($f)];
    }
  }
  echo json_encode($out);
}

function uploadFile(){
  global $uploadDir,$historyFile;
  if(empty($_FILES['file'])){ echo json_encode(['error'=>'No hay archivo']);return;}
  $n=basename($_FILES['file']['name']);
  if(move_uploaded_file($_FILES['file']['tmp_name'],$uploadDir.$n)){
    file_put_contents($historyFile,date('Y-m-d H:i:s')."|UPLOAD|$n\n",FILE_APPEND);
    echo json_encode(['success'=>true]);
  } else echo json_encode(['error'=>'Mover falla']);
}

function deleteMultiple(){
  global $uploadDir,$trashDir,$historyFile;
  $reason=trim($_POST['reason']??'');
  if(!$reason){ echo json_encode(['error'=>'Razón inválida']);return;}
  $errs=[];
  foreach($_POST['filenames'] as $n){
    $src=$uploadDir.basename($n);
    $dst=$trashDir.basename($n);
    if(is_file($src)&&rename($src,$dst)){
      file_put_contents($historyFile,date('Y-m-d H:i:s')."|DELETE|$n|$reason\n",FILE_APPEND);
    } else $errs[]=$n;
  }
  if(empty($errs)) echo json_encode(['success'=>true]);
  else echo json_encode(['error'=>'No borrados: '.implode(', ',$errs)]);
}

function listHistory(){
  global $historyFile;
  $e=[];
  if(file_exists($historyFile)){
    foreach(file($historyFile,FILE_IGNORE_NEW_LINES) as $l){
      $parts = explode('|',$l,4);
      $ts     = $parts[0];
      $act    = $parts[1];
      $fn     = $parts[2];
      $reason = $act==='DELETE' && isset($parts[3]) ? $parts[3] : '';
      $e[]=['timestamp'=>$ts,'action'=>$act,'filename'=>$fn,'reason'=>$reason];
    }
  }
  echo json_encode($e);
}