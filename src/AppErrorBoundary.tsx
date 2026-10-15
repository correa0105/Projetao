import {Component,type ReactNode} from 'react';
export class AppErrorBoundary extends Component<{children:ReactNode},{failed:boolean;attempt:number}>{
  state={failed:false,attempt:0};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(this.state.failed)return <main className="loading-content" role="alert" style={{minHeight:'100vh',display:'grid',alignContent:'center',justifyItems:'center',padding:24}}>
      <span className="loading-wordmark">Alvorada Cinzenta</span><h1>Não foi possível abrir esta página.</h1><p>Tente novamente para retomar sua aventura.</p>
      <button className="button primary" onClick={()=>this.setState(s=>({failed:false,attempt:s.attempt+1}))}>Tentar novamente</button>
      <button className="button ghost" onClick={()=>{location.hash='overview';this.setState(s=>({failed:false,attempt:s.attempt+1}));}}>Voltar ao início</button>
    </main>;
    return <span key={this.state.attempt} style={{display:'contents'}}>{this.props.children}</span>;
  }
}
